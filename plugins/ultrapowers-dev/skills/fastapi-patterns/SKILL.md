---
name: fastapi-patterns
description: "Use when building Python APIs with FastAPI — covers async endpoints, dependency injection, Pydantic models, middleware, and testing."
---

## Overview

FastAPI is a modern, high-performance Python web framework for building APIs with automatic OpenAPI docs, type validation via Pydantic, and native async support.

## When to Use

- **FastAPI** -- High-performance async APIs, automatic docs, strong typing
- **Django REST Framework** -- Full-featured web app with admin, ORM, batteries included
- **Flask** -- Lightweight apps where you want minimal structure

## Core Patterns

### Async Endpoints with Dependency Injection

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel

app = FastAPI()

class ItemCreate(BaseModel):
    name: str
    price: float
    description: str | None = None

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/items", status_code=201)
async def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(**item.model_dump())
    db.add(db_item)
    db.commit()
    return db_item
```

### Middleware and Exception Handling

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    return response

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})
```

### Router Organization

```python
from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/")
async def list_users():
    ...

app.include_router(router)
```

## Project Structure

```
app/
  main.py            # FastAPI app instance, startup
  config.py          # Settings via pydantic-settings
  models/            # SQLAlchemy / ORM models
  schemas/           # Pydantic request/response models
  routers/           # APIRouter modules
  dependencies.py    # Shared Depends() callables
  middleware.py      # Custom middleware
tests/
  conftest.py        # Fixtures (TestClient, test DB)
  test_items.py
```

## Testing

```python
from fastapi.testclient import TestClient
import pytest

@pytest.fixture
def client():
    return TestClient(app)

def test_create_item(client):
    resp = client.post("/items", json={"name": "Widget", "price": 9.99})
    assert resp.status_code == 201

# For async tests use httpx.AsyncClient
@pytest.mark.anyio
async def test_async_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/items")
    assert resp.status_code == 200
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Defining `def` endpoints that do blocking I/O | Use `async def` with async drivers, or keep `def` for sync-only code (FastAPI threads it) |
| Not using `response_model` | Always set `response_model` to control serialized output and hide internal fields |
| Forgetting dependency cleanup | Use `yield` in dependencies for teardown logic |
| Mutating default arguments in Pydantic | Use `Field(default_factory=list)` instead of `Field(default=[])` |
| Missing CORS middleware | Add `CORSMiddleware` explicitly -- it is not enabled by default |

## Attribution

**Original** -- Datatide, MIT licensed.
