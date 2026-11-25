---
name: laravel-patterns
description: "Use when building PHP web applications with Laravel — covers Eloquent ORM, middleware, queues, Blade templates, Livewire, and testing."
---

## Overview

Laravel is a PHP web framework with expressive syntax, providing Eloquent ORM, Blade templating, queue workers, built-in auth scaffolding, and an extensive ecosystem including Livewire for reactive UIs.

## When to Use

- **Laravel** -- Full-stack PHP apps with elegant ORM, queues, and rapid development
- **Symfony** -- When you need fine-grained control and highly decoupled components
- **Rails/Django** -- Similar philosophy in Ruby or Python ecosystems

## Core Patterns

### Eloquent ORM

```php
class Article extends Model
{
    protected $fillable = ['title', 'body', 'published_at'];
    protected $casts = ['published_at' => 'datetime'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->whereNotNull('published_at');
    }
}

// Usage
$articles = Article::published()->with('author')->paginate(20);
```

### Controllers and Form Requests

```php
class ArticleController extends Controller
{
    public function store(StoreArticleRequest $request): JsonResponse
    {
        $article = $request->user()->articles()->create(
            $request->validated()
        );
        return response()->json($article, 201);
    }
}

class StoreArticleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string'],
        ];
    }
}
```

### Middleware

```php
class EnsureJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');
        return $next($request);
    }
}
```

### Queued Jobs

```php
class ProcessUpload implements ShouldQueue
{
    use Queueable;

    public function __construct(private Upload $upload) {}

    public function handle(StorageService $storage): void
    {
        $storage->optimize($this->upload);
    }

    public function retries(): int { return 3; }
}
```

## Project Structure

```
app/
  Http/Controllers/     # Request handlers
  Models/               # Eloquent models
  Services/             # Business logic
  Jobs/                 # Queue jobs
  Http/Requests/        # Form request validation
  Http/Middleware/
routes/
  web.php, api.php      # Route definitions
resources/views/        # Blade templates
database/migrations/
tests/
  Feature/, Unit/
```

## Testing

```php
class ArticleTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_article(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/articles', [
                'title' => 'Hello',
                'body' => 'World',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('articles', ['title' => 'Hello']);
    }
}
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| N+1 queries | Use `with()` for eager loading; enable `Model::preventLazyLoading()` in dev |
| Mass assignment vulnerabilities | Always define `$fillable` or `$guarded` on models |
| Not using form requests | Extract validation from controllers into `FormRequest` classes |
| Forgetting queue workers in production | Use Supervisor or Laravel Horizon to manage workers |
| Raw DB queries bypassing Eloquent events | Use Eloquent methods so observers and events fire |

## Attribution

**Original** -- Datatide, MIT licensed.
