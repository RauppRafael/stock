# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server with HMR (`node ace serve --hmr`)
- `npm run build` — production build (`node ace build`)
- `npm start` — run the built server (`node bin/server.js`)
- `npm test` — run all Japa test suites (`node ace test`)
- Run a single suite: `node ace test unit` (or `functional`, `browser`)
- Run a single file: `node ace test --files="tests/unit/example.spec.ts"`
- Filter by title: `node ace test --tests="my test name"`
- `npm run lint` / `npm run format` — eslint / prettier
- `npm run typecheck` — `tsc --noEmit` plus `vue-tsc` for the Inertia project
- Ace generators (note kebab-case names): `node ace make:controller foo`, `make:model Foo`, `make:migration foo`, `make:middleware foo`, `make:validator foo`
- Migrations: `node ace migration:run`, `migration:rollback`, `migration:fresh`

Node ≥ 24 is required. `.env` must define `APP_KEY` (generate with `node ace generate:key`).

## Architecture

This is an **AdonisJS 7** monolith serving an **Inertia.js + Vue 3** SPA. Server, build tooling, and the SPA all live in one repo and one TypeScript project graph.

### Backend layout (`app/`, `start/`, `config/`, `database/`, `providers/`)

- **Subpath imports** are configured in `package.json` (`#controllers/*`, `#models/*`, `#middleware/*`, `#validators/*`, `#transformers/*`, `#start/*`, `#config/*`, `#database/*`, `#generated/*`, …). Use these instead of relative paths.
- **Routing** lives in `start/routes.ts`. Routes reference auto-generated controller bindings from `#generated/controllers` (see below) — e.g. `[controllers.Session, 'store']` — not raw strings.
- **HTTP middleware stack** is wired in `start/kernel.ts`. `silent_auth_middleware` runs globally so `auth.user` is populated when present; `auth` and `guest` are named middleware applied per route group.
- **Inertia integration**: `app/middleware/inertia_middleware.ts` extends `BaseInertiaMiddleware` and `share()`s `errors`, `flash`, and a transformed `user` to every page. The `MiddlewareSharedProps` declaration there augments `@adonisjs/inertia/types` so the frontend's `usePage<Data.SharedProps>()` is fully typed.
- **Auth**: session guard only (`config/auth.ts`). The `User` model composes `UserSchema` with `withAuthFinder(hash)`, so `User.verifyCredentials(email, password)` and `auth.use('web').login(user)` are the canonical login path.
- **Database**: SQLite via `better-sqlite3`, file at `tmp/db.sqlite3`. Lucid migrations live in `database/migrations/`. **`database/schema.ts` is auto-generated** from migrations — do not hand-edit; rerun `node ace migration:run` to regenerate. Models extend the generated `*Schema` classes (e.g. `User extends compose(UserSchema, withAuthFinder(hash))`).
- **Validators** use VineJS (`app/validators/`). Apply with `request.validateUsing(myValidator)`; errors flow into Inertia's shared `errors` prop automatically.
- **Custom API serializer** (`providers/api_provider.ts`) augments `HttpContext` with `ctx.serialize(data)`. It wraps responses under `{ data: ... }` and validates Lucid pagination metadata. Use this for any JSON API response so the shape stays consistent.
- **Transformers** (`app/transformers/`) extend `BaseTransformer<T>` and define `toObject()`. They are the only thing that should serialize Lucid models for output (see `UserTransformer` used in the Inertia middleware).

### Frontend layout (`inertia/`)

- Entry: `inertia/app.ts` (Vite entrypoint declared in `vite.config.ts`). SSR is wired (`inertia/ssr.ts`) but disabled by default in `config/inertia.ts`.
- Page components live in `inertia/pages/**/*.vue`; controllers render them via `inertia.render('auth/login', {...})` or routes use `router.on('/').renderInertia('home', {})`.
- A single layout (`inertia/layouts/default.vue`) is applied to every page through `resolvePageComponent(..., Layout)`. Flash messages from the shared `flash` prop are surfaced via `vue-sonner` toasts there.
- Vite aliases: `~/` → `inertia/`, `@generated` → `.adonisjs/client/`.
- **Tuyau** (`inertia/client.ts`) provides a typed route client. In templates use `<Link route="home">` / `<Form route="session.store">`; in scripts use `urlFor(...)`. The client is provided to all components via `<TuyauProvider>` in `inertia/app.ts`.

### Generated code in `.adonisjs/` — do not edit

`adonisrc.ts` runs three `init` hooks that regenerate this directory whenever the dev server boots or `node ace build` runs:

- `indexEntities({ transformers: { enabled: true, withSharedProps: true } })` → `.adonisjs/server/controllers.ts`, `events.ts`, `listeners.ts` (controller imports keyed by class name; this is what `#generated/controllers` resolves to) and the `Data.SharedProps` type used by `usePage`.
- `indexPages({ framework: 'vue3' })` → `.adonisjs/server/pages.d.ts` and route typings.
- `generateRegistry()` (Tuyau) → `.adonisjs/client/registry/` consumed by `inertia/client.ts`.

If a route, controller, page, or transformer is missing from autocomplete or shared props, restart `npm run dev` (or the type generation hook) rather than editing files under `.adonisjs/`.

### Tests (`tests/`)

Three suites are configured in `adonisrc.ts`:

- `unit` (`tests/unit/**/*.spec.{ts,js}`, 2s timeout)
- `functional` (`tests/functional/**/*.spec.{ts,js}`, 30s timeout)
- `browser` (`tests/browser/**/*.spec.{ts,js}`, 5min timeout — uses `@japa/browser-client`)

`tests/bootstrap.ts` registers the `assert`, AdonisJS, and `dbAssertions` plugins, and starts an HTTP server before functional/browser/e2e suites. `.env.test` is loaded automatically.

### Hot reload boundaries

`hotHook` in `package.json` marks `app/controllers/**` and `app/middleware/*` as HMR boundaries — edits there reload only the affected modules. Edits elsewhere (models, services, routes) restart the process.
