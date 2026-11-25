---
name: angular-patterns
description: "Use when building frontend applications with Angular — covers components, services, dependency injection, signals, standalone components, and testing."
---

## Overview

Angular is a full-featured TypeScript frontend framework by Google, providing dependency injection, reactive forms, routing, HTTP client, and a component-based architecture with strong opinions on project structure.

## When to Use

- **Angular** -- Enterprise apps needing DI, strong typing, and opinionated structure
- **React** -- Flexible UI library with large ecosystem, less opinionated
- **Vue** -- Approachable framework with gentle learning curve

## Core Patterns

### Standalone Components with Signals

```typescript
@Component({
  selector: "app-user-list",
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul>
      @for (user of users(); track user.id) {
        <li>{{ user.name }}</li>
      }
    </ul>
  `,
})
export class UserListComponent {
  private userService = inject(UserService);
  users = this.userService.users;
}
```

### Services and Dependency Injection

```typescript
@Injectable({ providedIn: "root" })
export class UserService {
  private http = inject(HttpClient);
  users = signal<User[]>([]);

  loadUsers() {
    this.http.get<User[]>("/api/users").subscribe((data) => {
      this.users.set(data);
    });
  }
}
```

### Routing with Guards and Resolvers

```typescript
export const routes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: "users/:id",
    component: UserDetailComponent,
    resolve: { user: userResolver },
  },
];

export const authGuard: CanActivateFn = () => {
  return inject(AuthService).isAuthenticated();
};
```

### Reactive Forms

```typescript
export class ProfileFormComponent {
  private fb = inject(FormBuilder);
  form = this.fb.group({
    name: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
  });

  onSubmit() {
    if (this.form.valid) {
      this.profileService.update(this.form.getRawValue());
    }
  }
}
```

## Project Structure

```
src/app/
  app.config.ts         # Application configuration
  app.routes.ts         # Top-level routes
  core/                 # Singleton services, guards, interceptors
  shared/               # Reusable components, pipes, directives
  features/
    users/
      user-list.component.ts
      user.service.ts
      user.routes.ts
```

## Testing

```typescript
describe("UserListComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [
        { provide: UserService, useValue: { users: signal([mockUser]) } },
      ],
    });
  });

  it("renders users", () => {
    const fixture = TestBed.createComponent(UserListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Alice");
  });
});
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Not unsubscribing from Observables | Use `takeUntilDestroyed()`, `async` pipe, or signals |
| Using modules when standalone works | Prefer standalone components in Angular 17+ |
| Overusing `any` types | Leverage TypeScript strict mode and generic types |
| Heavy `ngOnInit` logic | Move data fetching to resolvers or services |
| Direct DOM manipulation | Use template bindings, `@ViewChild`, or `Renderer2` |

## Attribution

**Original** -- Datatide, MIT licensed.
