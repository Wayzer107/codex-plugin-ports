import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const releaseApi = "https://api.github.com/repos/clangd/clangd/releases/latest";
const maxArchiveBytes = 256 * 1024 * 1024;
const maxExtractedBytes = 1024 * 1024 * 1024;
const maxEntryBytes = 512 * 1024 * 1024;
const maxEntries = 50_000;
const requestTimeoutMs = 5 * 60 * 1000;
const versionPattern = /^\d+\.\d+\.\d+$/;
const cacheManifestName = "current.json";

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function cacheRoot() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const base = localAppData && path.isAbsolute(localAppData)
      ? localAppData
      : path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "codex-plugin-ports", "clangd-lsp");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "codex-plugin-ports", "clangd-lsp");
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const base = xdgCacheHome && path.isAbsolute(xdgCacheHome)
    ? xdgCacheHome
    : path.join(os.homedir(), ".cache");
  return path.join(base, "codex-plugin-ports", "clangd-lsp");
}

function targetForRuntime() {
  const assets = {
    win32: { platform: "windows", binary: "clangd.exe" },
    darwin: { platform: "mac", binary: "clangd" },
    linux: { platform: "linux", binary: "clangd" },
  };
  const target = assets[process.platform];
  if (!target || process.arch !== "x64") {
    throw new Error(
      "Automatic clangd installation supports x64 Windows, macOS, and Linux. " +
      "Install clangd manually from https://clangd.llvm.org/installation on this platform.",
    );
  }
  return { ...target, key: target.platform + "-" + process.arch };
}

function isWithin(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative);
}

function readZipName(nameBytes, flags) {
  if ((flags & 0x0800) !== 0) {
    return new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
  }
  if (nameBytes.some((byte) => byte > 0x7f)) {
    throw new Error("The clangd release archive contains an unsupported filename encoding.");
  }
  return nameBytes.toString("ascii");
}

function safeZipEntry(root, rawName) {
  if (rawName.includes("\0")) throw new Error("The clangd release archive contains an invalid path.");
  const portableName = rawName.replaceAll("\\", "/");
  if (portableName.startsWith("/") || /^[A-Za-z]:/.test(portableName)) {
    throw new Error("The clangd release archive contains an absolute path.");
  }

  const isDirectory = portableName.endsWith("/");
  const rawParts = portableName.split("/");
  if (isDirectory) rawParts.pop();
  if (rawParts.length === 0 || rawParts.some((part) =>
    !part || part === "." || part === ".." || part.includes(":") || /[<>\"|?*]/.test(part))) {
    throw new Error("The clangd release archive contains an unsafe path.");
  }

  const relative = rawParts.join(path.sep);
  const destination = path.resolve(root, relative);
  if (!isWithin(root, destination)) throw new Error("The clangd release archive path escapes its cache directory.");
  return { relative, destination, isDirectory };
}

function endOfCentralDirectory(archive) {
  const firstPossible = Math.max(0, archive.length - 22 - 0xffff);
  for (let offset = archive.length - 22; offset >= firstPossible; offset -= 1) {
    if (archive.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = archive.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === archive.length) return offset;
  }
  throw new Error("The downloaded clangd release is not a valid ZIP archive.");
}

async function extractZip(archive, destinationRoot, signal) {
  const endOffset = endOfCentralDirectory(archive);
  const diskNumber = archive.readUInt16LE(endOffset + 4);
  const centralDisk = archive.readUInt16LE(endOffset + 6);
  const entriesOnDisk = archive.readUInt16LE(endOffset + 8);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount ||
      entryCount === 0xffff || entryCount > maxEntries ||
      centralOffset + centralSize > endOffset) {
    throw new Error("The downloaded clangd release uses an unsupported ZIP layout.");
  }

  let cursor = centralOffset;
  let expandedBytes = 0;
  const seenPaths = new Set();

  for (let index = 0; index < entryCount; index += 1) {
    signal?.throwIfAborted();
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("The downloaded clangd release has a malformed ZIP directory.");
    }

    const madeBy = archive.readUInt16LE(cursor + 4) >>> 8;
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const startDisk = archive.readUInt16LE(cursor + 34);
    const externalAttributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;

    if (cursor + recordLength > archive.length || startDisk !== 0 ||
        (flags & 0x0041) !== 0 || ![0, 8].includes(method) ||
        compressedSize === 0xffffffff || uncompressedSize === 0xffffffff ||
        localOffset === 0xffffffff || uncompressedSize > maxEntryBytes) {
      throw new Error("The downloaded clangd release contains an unsupported ZIP entry.");
    }

    const nameBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    const rawName = readZipName(nameBytes, flags);
    const entry = safeZipEntry(destinationRoot, rawName);
    const pathKey = entry.relative.toLowerCase();
    if (seenPaths.has(pathKey)) throw new Error("The downloaded clangd release contains duplicate paths.");
    seenPaths.add(pathKey);

    const unixMode = externalAttributes >>> 16;
    const unixType = unixMode & 0o170000;
    if (madeBy === 3 && unixType !== 0 && unixType !== 0o100000 && unixType !== 0o040000) {
      throw new Error("The downloaded clangd release contains a non-regular ZIP entry.");
    }
    if (madeBy === 3 && unixType === 0o120000) {
      throw new Error("The downloaded clangd release contains a symbolic link.");
    }

    const localHeaderEnd = localOffset + 30;
    if (localHeaderEnd > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("The downloaded clangd release has a malformed ZIP entry.");
    }
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localNameStart = localHeaderEnd;
    const dataStart = localNameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localFlags !== flags || localMethod !== method ||
        localNameLength !== nameLength ||
        !archive.subarray(localNameStart, localNameStart + localNameLength).equals(nameBytes) ||
        dataEnd > centralOffset) {
      throw new Error("The downloaded clangd release has inconsistent ZIP entry metadata.");
    }

    cursor += recordLength;
    expandedBytes += uncompressedSize;
    if (expandedBytes > maxExtractedBytes) {
      throw new Error("The downloaded clangd release exceeds the extraction size limit.");
    }

    if (entry.isDirectory) {
      if (uncompressedSize !== 0) throw new Error("The clangd release archive has an invalid directory entry.");
      await mkdir(entry.destination, { recursive: true, mode: 0o700 });
      continue;
    }

    const compressed = archive.subarray(dataStart, dataEnd);
    let content;
    try {
      content = method === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize) });
    } catch {
      throw new Error("A file in the downloaded clangd release could not be decompressed.");
    }
    if (content.length !== uncompressedSize || crc32(content) !== expectedCrc) {
      throw new Error("A file in the downloaded clangd release failed its ZIP integrity check.");
    }

    await mkdir(path.dirname(entry.destination), { recursive: true, mode: 0o700 });
    const fileMode = unixMode & 0o777;
    await writeFile(entry.destination, content, {
      flag: "wx",
      mode: fileMode || 0o600,
    });
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error("The downloaded clangd release has an invalid ZIP directory size.");
  }
}

async function findClangd(root, binaryName) {
  const pending = [root];
  const matches = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase() === binaryName.toLowerCase()) {
        matches.push(fullPath);
      }
    }
  }
  if (matches.length !== 1) {
    throw new Error("The official clangd release archive did not contain exactly one clangd executable.");
  }
  return matches[0];
}

async function verifyClangd(binary, expectedVersion) {
  if (!(await stat(binary).catch(() => null))?.isFile()) {
    throw new Error("The cached clangd executable is missing.");
  }
  await access(binary, fsConstants.X_OK);
  let result;
  try {
    result = await execFileAsync(binary, ["--version"], {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    });
  } catch {
    throw new Error("The cached clangd executable could not be started on this machine.");
  }

  const output = String(result.stdout ?? "") + String(result.stderr ?? "");
  const match = /\bclangd version\s+(\d+\.\d+\.\d+)\b/i.exec(output);
  if (!match || match[1] !== expectedVersion) {
    throw new Error("The clangd executable version did not match the verified release.");
  }
}

function relativeCachePath(root, value) {
  if (typeof value !== "string" || !value || value.includes("\\")) return null;
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) return null;
  const absolute = path.resolve(root, ...parts);
  return isWithin(root, absolute) ? absolute : null;
}

async function readCachedInstall(root, target) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(root, cacheManifestName), "utf8"));
  } catch {
    return null;
  }

  if (!manifest || manifest.platform !== target.key ||
      typeof manifest.version !== "string" || !versionPattern.test(manifest.version) ||
      typeof manifest.digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(manifest.digest)) {
    return null;
  }
  const binary = relativeCachePath(root, manifest.binary);
  if (!binary) return null;
  try {
    await verifyClangd(binary, manifest.version);
    return binary;
  } catch {
    return null;
  }
}

async function fetchLatestRelease(signal) {
  signal?.throwIfAborted();
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)])
    : AbortSignal.timeout(requestTimeoutMs);
  const response = await fetch(releaseApi, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "codex-plugin-ports-clangd-installer",
    },
    signal: requestSignal,
  });
  if (!response.ok) throw new Error("Could not read the latest stable clangd release from GitHub (HTTP " + response.status + ").");
  const release = await response.json();
  if (!release || release.draft || release.prerelease ||
      typeof release.tag_name !== "string" || !versionPattern.test(release.tag_name)) {
    throw new Error("GitHub did not return a valid stable clangd release.");
  }
  return release;
}

function releaseAsset(release, target) {
  const name = "clangd-" + target.platform + "-" + release.tag_name + ".zip";
  const asset = Array.isArray(release.assets) ? release.assets.find((item) => item?.name === name) : null;
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > maxArchiveBytes ||
      typeof asset.digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(asset.digest)) {
    throw new Error("The latest stable clangd release has no supported, SHA-256-verified asset for this platform.");
  }
  return asset;
}

async function downloadAsset(asset, release, signal) {
  signal?.throwIfAborted();
  const url = "https://github.com/clangd/clangd/releases/download/" +
    encodeURIComponent(release.tag_name) + "/" + encodeURIComponent(asset.name);
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)])
    : AbortSignal.timeout(requestTimeoutMs);
  const response = await fetch(url, {
    headers: { "User-Agent": "codex-plugin-ports-clangd-installer" },
    signal: requestSignal,
  });
  if (!response.ok || !response.body) {
    throw new Error("Could not download the verified clangd release asset (HTTP " + response.status + ").");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxArchiveBytes) {
    throw new Error("The clangd release asset exceeds the download size limit.");
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    signal?.throwIfAborted();
    length += chunk.byteLength;
    if (length > asset.size || length > maxArchiveBytes) {
      throw new Error("The clangd release download exceeded its declared size.");
    }
    chunks.push(Buffer.from(chunk));
  }

  if (length !== asset.size) throw new Error("The clangd release download was incomplete.");
  const archive = Buffer.concat(chunks, length);
  const actualDigest = "sha256:" + createHash("sha256").update(archive).digest("hex");
  if (actualDigest !== asset.digest) {
    throw new Error("The downloaded clangd release failed its SHA-256 integrity check.");
  }
  return archive;
}

async function writeCurrentManifest(root, manifest) {
  const finalPath = path.join(root, cacheManifestName);
  const temporaryPath = path.join(root, ".current-" + process.pid + "-" + Math.random().toString(16).slice(2) + ".json");
  try {
    await writeFile(temporaryPath, JSON.stringify(manifest, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, finalPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function installLatestClangd(root, target, signal) {
  const release = await fetchLatestRelease(signal);
  const asset = releaseAsset(release, target);
  const digest = asset.digest;
  const installDirectory = path.join(root, release.tag_name, target.key);
  const existingBinary = await findClangd(installDirectory, target.binary).catch(() => null);
  if (existingBinary) {
    try {
      await verifyClangd(existingBinary, release.tag_name);
      const relative = path.relative(root, existingBinary).split(path.sep).join("/");
      await writeCurrentManifest(root, {
        version: release.tag_name,
        platform: target.key,
        digest,
        binary: relative,
      });
      return existingBinary;
    } catch {
      await rm(installDirectory, { recursive: true, force: true });
    }
  }

  const archive = await downloadAsset(asset, release, signal);
  signal?.throwIfAborted();
  const stagingDirectory = await mkdtemp(path.join(root, ".install-"));
  const extractedDirectory = path.join(stagingDirectory, "files");
  await mkdir(extractedDirectory, { mode: 0o700 });
  try {
    await extractZip(archive, extractedDirectory, signal);
    const stagedBinary = await findClangd(extractedDirectory, target.binary);
    if (process.platform !== "win32") await chmod(stagedBinary, 0o755);
    await verifyClangd(stagedBinary, release.tag_name);
    signal?.throwIfAborted();

    await mkdir(path.dirname(installDirectory), { recursive: true, mode: 0o700 });
    try {
      await rename(extractedDirectory, installDirectory);
    } catch (error) {
      const competingBinary = await findClangd(installDirectory, target.binary).catch(() => null);
      if (!competingBinary) throw error;
      await verifyClangd(competingBinary, release.tag_name);
    }

    const binary = path.join(installDirectory, path.relative(extractedDirectory, stagedBinary));
    await verifyClangd(binary, release.tag_name);
    const relative = path.relative(root, binary).split(path.sep).join("/");
    await writeCurrentManifest(root, {
      version: release.tag_name,
      platform: target.key,
      digest,
      binary: relative,
    });
    return binary;
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

let pendingInstall;

export function ensureClangdInstalled(signal) {
  if (!pendingInstall) {
    pendingInstall = (async () => {
      signal?.throwIfAborted();
      const target = targetForRuntime();
      const root = cacheRoot();
      await mkdir(root, { recursive: true, mode: 0o700 });

      const cached = await readCachedInstall(root, target);
      if (cached) return cached;

      return installLatestClangd(root, target, signal);
    })().finally(() => {
      pendingInstall = undefined;
    });
  }
  return pendingInstall;
}

// Generic entry point used by lsp-client.mjs for profiles with "autoInstall".
export { ensureClangdInstalled as ensureInstalled };
