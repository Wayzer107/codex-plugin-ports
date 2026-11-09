# Update guidelines

Add durable details that would have prevented repeated discovery or a real mistake. Useful examples include verified commands with their working directory, recurring environment quirks, test setup, and non-obvious invariants. Leave transient incident history, secrets, private identifiers, and generic advice out of project instructions.

1. Resolve the effective guidance for the files or directories involved. Check parent rules and shadowing before proposing an addition.
2. Check existing text for duplication and verify each claim against a file, command result, or directly observed behavior. If the evidence is incomplete, state the gap and leave the claim out of the proposed file.
3. Present each target path, why the change matters, and the complete proposed file for review. Show a diff if explicitly requested. When there is nothing durable to change, report that and stop.
4. After the user authorizes the specific edits, re-read the target. Preserve existing structure and unrelated content, and account for intervening edits. Apply only the authorized changes. Confirm the resulting content and its effective scope.

For example, add “From `packages/api`, run `pnpm test:unit` for API unit tests. The root test command skips this package.” only if both the package command and the root coverage claim are supported.
