---
name: flask-patterns
description: "Use when building Python web applications with Flask — covers blueprints, extensions, application factory, context management, and testing."
---

## Overview

Flask is a lightweight Python web micro-framework that gives you the essentials (routing, templates, request handling) and lets you choose your own components for everything else.

## When to Use

- **Flask** -- Small-to-medium apps, microservices, when you want full control over components
- **FastAPI** -- API-first with automatic docs, async, and Pydantic validation
- **Django** -- Large apps needing built-in ORM, admin, auth, and migrations

## Core Patterns

### Application Factory

```python
def create_app(config_name="default"):
    app = Flask(__name__)
    app.config.from_object(configs[config_name])

    db.init_app(app)
    migrate.init_app(app, db)

    from .routes.users import users_bp
    app.register_blueprint(users_bp, url_prefix="/api/users")

    return app
```

### Blueprints for Modular Routes

```python
from flask import Blueprint, request, jsonify

users_bp = Blueprint("users", __name__)

@users_bp.route("/", methods=["GET"])
def list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])

@users_bp.route("/", methods=["POST"])
def create_user():
    data = request.get_json()
    user = User(**data)
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201
```

### Error Handling and Context

```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.before_request
def load_current_user():
    token = request.headers.get("Authorization")
    g.current_user = verify_token(token) if token else None

@app.teardown_appcontext
def close_db(exception):
    db.session.remove()
```

### Extensions Pattern

```python
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_marshmallow import Marshmallow

db = SQLAlchemy()          # Init without app
migrate = Migrate()
ma = Marshmallow()

# Bind in factory: db.init_app(app)
```

## Project Structure

```
project/
  app/
    __init__.py          # create_app() factory
    extensions.py        # db, migrate, ma instances
    models/
      user.py
    routes/
      users.py           # Blueprint
    schemas/             # Marshmallow schemas
    services/            # Business logic
  config.py              # Config classes
  tests/
    conftest.py          # app fixture, test client
    test_users.py
  wsgi.py                # create_app() entry point
```

## Testing

```python
import pytest
from app import create_app

@pytest.fixture
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_list_users(client):
    resp = client.get("/api/users/")
    assert resp.status_code == 200

def test_create_user(client):
    resp = client.post("/api/users/", json={"name": "Alice"})
    assert resp.status_code == 201
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Circular imports | Use application factory and init extensions without app |
| Working outside app context | Wrap code in `with app.app_context()` or use `current_app` |
| No input validation | Use Marshmallow, Pydantic, or webargs for request validation |
| Global app instance in tests | Always use the factory pattern so each test gets a fresh app |
| Not using blueprints | Organize routes into blueprints early to avoid a monolithic app |

## Attribution

**Original** -- Datatide, MIT licensed.
