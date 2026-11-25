---
name: express-patterns
description: "Use when building Node.js web servers with Express — covers middleware chains, routing, error handling, security, and testing."
---

## Overview

Express is the most widely used Node.js web framework, providing a minimal and flexible middleware-based architecture for building HTTP servers and APIs.

## When to Use

- **Express** -- Simple, mature, massive ecosystem, middleware-centric
- **Fastify** -- When you need better performance and built-in schema validation
- **NestJS** -- When you want opinionated structure with decorators and DI

## Core Patterns

### Middleware Chain

```javascript
// Middleware executes in order; call next() to continue
app.use(express.json());
app.use(cors());
app.use(helmet());

// Custom middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  req.user = verifyToken(token);
  next();
};
```

### Router Organization

```javascript
import { Router } from "express";
const router = Router();

router.get("/", async (req, res) => {
  const users = await UserService.findAll();
  res.json(users);
});

router.post("/", validate(createUserSchema), async (req, res) => {
  const user = await UserService.create(req.body);
  res.status(201).json(user);
});

export default router;

// Mount in app
app.use("/api/users", authenticate, router);
```

### Centralized Error Handling

```javascript
// Async wrapper to catch promise rejections
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get("/:id", asyncHandler(async (req, res) => {
  const item = await ItemService.findById(req.params.id);
  if (!item) throw new NotFoundError("Item not found");
  res.json(item);
}));

// Error middleware (4 args) -- must be last
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message });
});
```

## Project Structure

```
src/
  app.js              # Express app setup, middleware
  server.js           # Listen (separated for testing)
  routes/
    users.routes.js
    items.routes.js
  middleware/
    auth.js, validate.js, errorHandler.js
  services/           # Business logic
  models/             # ORM models (Prisma, Sequelize, etc.)
tests/
  users.test.js
```

## Testing

```javascript
import request from "supertest";
import app from "../src/app.js";

describe("GET /api/users", () => {
  it("returns 200 with user list", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app).post("/api/users").send({});
    expect(res.status).toBe(401);
  });
});
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Unhandled async errors crash the process | Wrap async handlers or use `express-async-errors` |
| Error middleware not triggered | Ensure it has exactly 4 parameters and is registered last |
| Missing security headers | Use `helmet()` middleware |
| `req.body` is undefined | Register `express.json()` before routes |
| Not separating app from server | Export `app` without `.listen()` so tests can use supertest |

## Attribution

**Original** -- Datatide, MIT licensed.
