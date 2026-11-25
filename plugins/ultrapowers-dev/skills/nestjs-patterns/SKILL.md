---
name: nestjs-patterns
description: "Use when building Node.js backends with NestJS — covers modules, controllers, providers, pipes, guards, interceptors, and testing."
---

## Overview

NestJS is an opinionated Node.js framework built on TypeScript that uses decorators and dependency injection, inspired by Angular's architecture. It supports Express or Fastify under the hood.

## When to Use

- **NestJS** -- Structured enterprise backends with DI, decorators, and modular architecture
- **Express** -- Simple APIs where you want minimal abstraction
- **Fastify** -- Performance-critical APIs with schema-based validation

## Core Patterns

### Modules, Controllers, and Providers

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  create(dto: CreateUserDto): Promise<User> {
    return this.repo.save(this.repo.create(dto));
  }
}
```

### Validation Pipes and DTOs

```typescript
class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;
}

// Global validation pipe
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

### Guards and Interceptors

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.headers.authorization;
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`${Date.now() - now}ms`)),
    );
  }
}
```

## Project Structure

```
src/
  main.ts                # Bootstrap, global pipes/guards
  app.module.ts          # Root module
  common/
    guards/, interceptors/, filters/, pipes/
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    dto/
      create-user.dto.ts
    entities/
      user.entity.ts
    users.service.spec.ts
```

## Testing

```typescript
describe("UsersService", () => {
  let service: UsersService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useClass: Repository },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it("returns all users", async () => {
    jest.spyOn(repo, "find").mockResolvedValue([mockUser]);
    expect(await service.findAll()).toEqual([mockUser]);
  });
});
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Circular dependencies | Use `forwardRef()` or restructure modules |
| Not using `whitelist: true` in ValidationPipe | Without it, extra properties pass through unstripped |
| Forgetting to register providers | Every injectable must be in a module's `providers` array |
| Mixing Express-specific code | Use NestJS abstractions so you can swap to Fastify |
| Not exporting shared services | Add services to `exports` in their module for cross-module use |

## Attribution

**Original** -- Datatide, MIT licensed.
