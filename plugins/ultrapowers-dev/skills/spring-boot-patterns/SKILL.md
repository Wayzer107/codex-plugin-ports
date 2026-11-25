---
name: spring-boot-patterns
description: "Use when building or reviewing Spring Boot applications. Covers auto-configuration, layered architecture, Bean lifecycle, profiles, actuator, and testing with MockMvc."
---

# Spring Boot Patterns

Spring Boot is convention over configuration for the JVM. Auto-configuration does the wiring; your job is to follow the layered architecture and let the framework manage the lifecycle.

## Auto-Configuration & Starters

- **Starters bundle dependencies.** `spring-boot-starter-web` brings Tomcat, Jackson, and MVC auto-config. Add starters, not individual jars.
- **Auto-configuration backs off** when you define your own Bean. Override defaults by declaring a `@Bean` method in a `@Configuration` class.
- **`application.yml` over `application.properties`** for nested configuration. Use `@ConfigurationProperties` for type-safe config binding.

## Layered Architecture

- **Controller** (`@RestController`): thin HTTP mapping. Validate input, delegate, respond.
- **Service** (`@Service`): business logic, `@Transactional` boundaries.
- **Repository** (`@Repository`): data access. `JpaRepository<Entity, ID>` gives CRUD + pagination.
- **Config** (`@Configuration`): bean definitions, security, CORS.

## Bean Lifecycle & Profiles

- **`@PostConstruct`** for initialization after injection. Default scope is singleton.
- **Conditional beans:** `@ConditionalOnProperty`, `@ConditionalOnMissingBean` for feature flags.
- **Profiles** separate environment config: `@Profile("dev")`, `@Profile("prod")`. Activate with `SPRING_PROFILES_ACTIVE=dev`.
- **Externalize secrets** via environment variables -- never commit credentials.

## Actuator

- Add `spring-boot-starter-actuator` for `/actuator/health`, `/actuator/metrics`, `/actuator/info`.
- **Secure actuator endpoints** in production: expose only `/health` and `/info` publicly.
- Custom health indicators: implement `HealthIndicator` for downstream dependency checks.

## Testing

- **`@SpringBootTest`** loads full context -- use for integration tests only.
- **`@WebMvcTest(Controller.class)`** loads only the web layer. Use `MockMvc` for controller tests.
- **`@DataJpaTest`** for repository tests with an embedded database.
- **Mock dependencies** with `@MockBean` to isolate the layer under test.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Circular dependencies between beans | Refactor to unidirectional; use `@Lazy` as last resort |
| `@Transactional` on private methods (no-op) | Must be on public methods; Spring uses proxies |
| Loading full context for unit tests | Use `@WebMvcTest` or `@DataJpaTest` slices instead |
| N+1 queries with JPA lazy loading | Use `@EntityGraph` or `JOIN FETCH` in JPQL |
| Fat controllers with business logic | Move logic to `@Service`; controllers only map HTTP |

## Attribution
**Original** -- Datatide, MIT licensed. See also [github/awesome-copilot](https://github.com/github/awesome-copilot) for official Spring Boot skills.
