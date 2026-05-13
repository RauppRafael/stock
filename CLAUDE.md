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
- Ace generators (note kebab-case names): `node ace make:controller foo`, `make:model Foo`, `make:migration foo`, `make:middleware foo`, `make:validator foo`, `make:seeder foo`, `make:command foo`
- Migrations: `node ace migration:run`, `migration:rollback`, `migration:fresh` (use `--seed` to reseed after wiping)
- Seeding: `node ace db:seed` runs `database/seeders/*.ts` in alpha order
- User admin: `node ace user:create [--email --full-name --password]` and `node ace user:edit <emailOrId> [--full-name --email --password --reset-password]`. Both prompt interactively when flags are omitted.

Node ≥ 24 is required. `.env` must define `APP_KEY` (generate with `node ace generate:key`) plus the MySQL `DB_*` keys (see `.env.example`). `SEED_USER_*` keys are optional and consumed by `database/seeders/user_seeder.ts`.

## Architecture

This is an **AdonisJS 7** monolith serving an **Inertia.js + Vue 3** SPA. Server, build tooling, and the SPA all live in one repo and one TypeScript project graph.

### Domain model (inventory)

A clothing-brand inventory: `Product` belongs to a `Category` whose flags (`hasColor`, `hasSize`) decide which attributes its variants carry. Every `Variant` is the (product, color?, size?) tuple used as the SKU grain. `Stock` tracks quantity per (variant, location). `StockMovement` is an append-only audit row written every time stock changes.

Prints are intentionally **not** a separate entity. A "Fold Hoodie Plain" and a "Fold Hoodie Puff" are two distinct products in the catalog — the print is folded into the product's name and code, not modelled as a relation or variant axis.

**Wildcard products** sit alongside printed products: a `Product` with `is_wildcard = true` is a printless base (e.g. "Fold Hoodie Blank") whose stock acts as a shared pool. Other products in the same category set `wildcard_id` to point at it; the relation is strictly one level deep. On a Shopify push the wildcard's matching-`(color, size)` stock is folded into each derivative's effective quantity (`ShopifySyncService.computeEffectiveTotals`) — wildcards are never pushed independently. The conversion flow (`/stock/convert`, `WildcardService.convert`) writes a paired `−N` wildcard / `+N` derivative `StockMovement` in one transaction. A DB `CHECK (NOT (is_wildcard AND wildcard_id IS NOT NULL))` plus a same-category guard in `ProductsController` keep the relation coherent. UI surfaces the relationship with a 🃏 icon: on `/stock` printed rows show a `🃏 +N` pool chip via the server-computed `pools` prop (`WildcardService.computePoolMap`), and on `/sync` push/pull rows show a `+N from wildcard` chip when the pool contributes.

Key invariants:

- All stock writes go through `app/services/stock_service.ts` inside a single DB transaction with `forUpdate()` on the stock row, so quantity + history can never drift.
- Variant uniqueness on `(product_id, color_id, size_id)` is enforced via a DB unique index _plus_ `app/services/variant_generator.ts`, which dedupes during the cartesian-product create flow (MySQL treats NULLs as distinct, so the index alone wouldn't catch hat-style "no-size" duplicates).
- SKU is **derived data, not stored**. `Variant.skuCode` and `Variant.displayName` are `@computed()` getters in `app/models/variant.ts` that combine the preloaded `product/color/size` codes through `app/services/sku_builder.ts`. The SKU updates instantly when an attribute's `code` changes.
- `Category` and `Product` use a custom `withSoftDelete` mixin (`app/models/mixins/soft_delete.ts`). Use `Model.notTrashed()` / `model.trash()` / `model.restore()`. Hard delete is intentionally absent for these so movement history stays readable.
- `Color`, `Size`, and `Product` each have a short `code` field (uppercase `[A-Z0-9]+`, max 8/16 chars) — these compose the rendered SKU (e.g. `FLDH-PL-NUDE-S`, where `PL` is part of the product code itself).

### Backend layout (`app/`, `start/`, `config/`, `database/`, `providers/`)

- **Subpath imports** are configured in `package.json` (`#controllers/*`, `#models/*`, `#services/*`, `#middleware/*`, `#validators/*`, `#transformers/*`, `#start/*`, `#config/*`, `#database/*`, `#generated/*`, …). Use these instead of relative paths.
- **FK delete rules are tuned for data preservation**: `variants.product_id` and `stocks.variant_id` are `RESTRICT` (hard-deleting a product/variant errors instead of cascading away its stock + history). `stock_movements.user_id` is `SET NULL` so deleting a user keeps the audit trail. `products.wildcard_id` is `RESTRICT` too — `ProductsController#destroy` refuses to archive a wildcard that still has active derivatives, so soft-deleting can never orphan a printed product's pool source. The migration `1761886300000_harden_fk_delete_rules.ts` documents the rationale; never relax to CASCADE without understanding the chain.
- **Routing** (`start/routes.ts`): all inventory routes are inside the `auth` middleware group. Routes reference auto-generated controller bindings from `#generated/controllers` — e.g. `[controllers.Stock, 'adjust']` — never raw strings. Lookup endpoints under `/stock/lookup/*` return JSON for the cascading variant selector.
- **HTTP middleware stack** wired in `start/kernel.ts`. `silent_auth_middleware` runs globally so `auth.user` is populated when present; `auth` and `guest` are named middleware applied per route group.
- **Inertia integration**: `app/middleware/inertia_middleware.ts` extends `BaseInertiaMiddleware` and `share()`s `errors`, `flash`, and a transformed `user` to every page. The `MiddlewareSharedProps` declaration there augments `@adonisjs/inertia/types` so the frontend's `usePage<Data.SharedProps>()` is fully typed.
- **Auth**: session guard only (`config/auth.ts`). The `User` model composes `UserSchema` with `withAuthFinder(hash)`, so `User.verifyCredentials(email, password)` and `auth.use('web').login(user)` are the canonical login path. **There is no public signup route** — accounts are provisioned via `node ace user:create` or the seeder. (See "Auth scoping caveat" below.)
- **Database**: MySQL via `mysql2` (`config/database.ts`, env-driven). Lucid migrations live in `database/migrations/`. **`database/schema.ts` is auto-generated** from migrations — do not hand-edit; rerun `node ace migration:run` to regenerate. Models extend the generated `*Schema` classes (e.g. `User extends compose(UserSchema, withAuthFinder(hash))`).
- **Seeders** in `database/seeders/`. `catalog_seeder.ts` seeds categories, attributes (with codes), locations, and demo products with variants. `user_seeder.ts` upserts a default admin from `SEED_USER_*` env vars (defaults: `admin@stock.local` / `changeme123`). `node ace db:seed` runs both.
- **Services** in `app/services/`: `StockService.adjust(...)`, `VariantGenerator.generate(product, category, selection)`, `buildSkuCode(...)`, `WildcardService.convert(...)`. Controllers should never call models directly for stock writes — always go through `StockService`. `StockService.adjust` accepts an optional `trx` so other services (`ShopifySyncService.applyPull`, `WildcardService.convert`) can atomically wrap stock changes with their own side-state updates. `WildcardService.convert` `firstOrCreate`s both stock rows and locks both with `forUpdate` _before_ computing `newQuantity` — the target row must not be read snapshot-only, or a concurrent adjuster could drift between the read and `StockService.adjust`'s own lock.
- **Validators** use VineJS (`app/validators/`). Apply with `request.validateUsing(myValidator)`; errors flow into Inertia's shared `errors` prop automatically. ID/integer fields use `vine.number().withoutDecimals().positive()`. Update validators take metadata (e.g. `meta: { id: model.id }`) so uniqueness checks can exclude the current row. Lookup-endpoint URL params are validated through dedicated validators in `validators/stock.ts`.
- **Custom API serializer** (`providers/api_provider.ts`) augments `HttpContext` with `ctx.serialize(data)`. It wraps responses under `{ data: ... }` and resolves transformer Items/Collections into plain JSON. Use this for any JSON API response (e.g. the `/stock/lookup/*` endpoints) — `response.json({ data: Transformer.transform(...) })` returns the raw Item wrapper instead of resolved data.
- **Transformers** (`app/transformers/`) extend `BaseTransformer<T>` and define `toObject()`. They are the only thing that should serialize Lucid models for output. **Always chain `.depth(6)` on nested transformer calls** (`ProductTransformer.transform(p.category).depth(6)`) — the default Item depth is 1, which silently drops nested relations from `Data.*` types when the model is consumed inside another transformer's output.
- **Ace commands** in `commands/` are auto-discovered. `user:create` and `user:edit` use `this.prompt.ask` / `secure` / `confirm` for interactive flows; both reuse the `createUserValidator` / `updateUserValidator` so DB-level rules (uniqueness, length, format) match the HTTP path.

### Frontend layout (`inertia/`)

- Entry: `inertia/app.ts` (Vite entrypoint declared in `vite.config.ts`). Tailwind v4 via `@tailwindcss/vite`; design tokens + component classes (`btn-primary`, `input`, `label`, `card`, `badge`, …) live in `inertia/css/app.css`.
- Page components live in `inertia/pages/**/*.vue`; controllers render them via `inertia.render('stock/adjust', {...})`.
- A single layout (`inertia/layouts/default.vue`) provides the chrome: a static sidebar at `lg+` and a slide-out drawer with a hamburger top bar below `lg`. Flash messages from the shared `flash` prop surface via `vue-sonner` toasts.
- Vite aliases: `~/` → `inertia/`, `@generated` → `.adonisjs/client/`.
- **Tuyau** (`inertia/client.ts`) provides a typed route client. In templates use `<Link route="stock.index">` / `<Form route="stock.adjust">`; in scripts use `urlFor(...)`. The client is provided to all components via `<TuyauProvider>` in `inertia/app.ts`. `inertia/types.ts` re-exports `RouteName = keyof Registry` for components that take a route prop (e.g. `ConfirmButton`).
- **Reusable components** (`inertia/components/`):
  - `PageHeader` — title + description + `#actions` slot.
  - `DataTable<T>` — generic sortable-style table with `#cell:<key>` slots and an empty state.
  - `StockBadge` — colored quantity pill (out / low / ok) driven by `quantity` + `threshold`.
  - `MovementRow` — formatted history row used by both the global movements page and the product detail page.
  - `AttributeMultiSelect<T>` — pill-style multi-select used in product create/edit.
  - `VariantSelector` — cascading Location → Category → Product → Color/Print/Size selector. Categories render as icon+label buttons (using `category.icon` emoji), colors as swatches. After picking a category it auto-selects the first product, and after a product it auto-selects the first available color/print/size — so the user lands on a fully-resolved variant in one click. Accepts `initialVariant` + `initialLocationId` to restore state from a stock-row click. Defaults `locationId` to `locations[0]` when unset.
  - `VariantSummary` — display-only card for the resolved variant (size letter or color swatch as the icon, attribute pills, location, current on-hand). Used by the stock-adjust page.
  - `QuantityStepper` — controlled number input with `−`/`+` buttons and a live "Was N → ±delta" preview underneath. `v-model:modelValue` plus a `current` prop for the baseline.
  - `Modal` — teleported dialog used by all attribute/location CRUD pages.
  - `ConfirmButton` — runs `confirm(message)` and only then calls `router.visit(...)` with the chosen method. Built deliberately as a click handler (not an Inertia `<Form>` wrapper) because Inertia's submit interception didn't reliably honour `event.preventDefault()` from the `@submit` listener — meaning a "Cancel" click could still mutate.
  - `SyncVariantCell` — compact variant cell for the `/sync` tables: product name + color swatch chip + size box, matching the visual language used in `VariantSummary` / `VariantSelector`.
- **Frontend domain types are auto-generated**. `@generated/data` exposes `Data.Category`, `Data.Product`, `Data.Variant`, `Data.Stock`, `Data.StockMovement`, `Data.User`, `Data.Color`, `Data.Size`, plus `Data.SharedProps`. They're inferred from each transformer's `toObject()` return type via `InferData`. Do **not** hand-write parallel TS interfaces — change the transformer if the page needs more fields.

### Wire-shape contracts (`shared/contracts/`)

Zod schemas in `shared/contracts/index.ts` are the source of truth for the JSON shape that travels back→front. They mirror what the back-end transformers produce and let the SPA verify it at runtime.

- Pages call `useValidatedProps(props, pageSchema)` (composable in `inertia/composables/use_validated_props.ts`); a mismatch logs a noisy `console.error` so back-end drift surfaces immediately instead of presenting as an `undefined` ten components deep.
- The cascading lookup endpoints (`/stock/lookup/*`) parse their fetch responses through `dataEnvelope(productSchema.array())` etc. before populating the selector.
- The Vite alias `@contracts` and the inertia `tsconfig.json` path mapping point at `shared/contracts/index.ts`. Add a path in there when you build a new page that takes new server-side props.
- The contracts intentionally do **not** validate input (size/positivity/uniqueness) — VineJS already enforces that on the back-end. They only assert the JSON wire shape (types + nullable vs. required).

### Generated code in `.adonisjs/` — do not edit

`adonisrc.ts` runs three `init` hooks that regenerate this directory whenever the dev server boots or `node ace build` runs:

- `indexEntities({ transformers: { enabled: true, withSharedProps: true } })` → `.adonisjs/server/controllers.ts`, `events.ts`, `listeners.ts`, and `.adonisjs/client/data.d.ts` (the `Data.*` namespace).
- `indexPages({ framework: 'vue3' })` → `.adonisjs/server/pages.d.ts` and route typings.
- `generateRegistry()` (Tuyau) → `.adonisjs/client/registry/` consumed by `inertia/client.ts`. Only refreshed when the dev server boots; the `node ace build` typecheck stage uses whatever it last wrote.

If a route, controller, page, or transformer is missing from autocomplete or shared props, restart `npm run dev` (or run `node ace build`) rather than editing files under `.adonisjs/`.

### Tests (`tests/`)

Three suites are configured in `adonisrc.ts`:

- `unit` (`tests/unit/**/*.spec.{ts,js}`, 2s timeout) — `bootstrap.ts` migrates the test DB before the suite and truncates tables before each test.
- `functional` (`tests/functional/**/*.spec.{ts,js}`, 30s timeout)
- `browser` (`tests/browser/**/*.spec.{ts,js}`, 5min timeout — uses `@japa/browser-client`)

`tests/bootstrap.ts` registers the `assert`, AdonisJS, and `dbAssertions` plugins, and starts an HTTP server before functional/browser/e2e suites. `.env.test` is loaded automatically and points at the `stock_test` MySQL DB. `tests/unit/stock_service.spec.ts` covers create-from-zero, increment, decrement, validation rejection, FK rollback, and outer-transaction isolation for `StockService`.

### Shopify sync (`/sync`)

Operator-driven sync between local inventory and one Shopify store. Lives under `/sync` with three tabs (Link / Push / Pull). Designed for single-tenant internal use; not webhook-driven and not exposed to merchants.

**Auth model — read this before changing config**: As of Jan 2026, Shopify retired legacy `shpat_` permanent tokens. Apps are now created at `dev.shopify.com` and authenticate via the OAuth **client credentials grant**. The local app holds `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` and exchanges them for a 24h Admin API access token at runtime. The Dev Dashboard "app" is purely a credentials container — there's no merchant-facing app to ship. Install on the store via Distribution → Custom distribution → install link. Scopes (`read_products`, `write_inventory`, `read_inventory`, `read_locations`) are configured by editing `shopify.app.toml` and running `shopify app deploy` — there's no UI for scopes in the new dashboard.

**Env**: `SHOPIFY_SHOP_DOMAIN` (e.g. `cool-brand.myshopify.com` — never the customer-facing custom domain), `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, optional `SHOPIFY_API_VERSION` (defaults to `2025-10` in `config/shopify.ts`). All three are optional — when missing, `/sync` renders a "configure first" empty state instead of crashing.

**Data model**:

- `shopify_variant_links` (join table) — one local `Variant` can mirror many Shopify variants. `shopify_variant_id` is UNIQUE (one Shopify variant can't bind to two locals); `variant_id` is NOT unique. Each link stores `last_known_quantity` (what we last pushed to or observed on Shopify) — essential for correct delta math when sales hit different duplicates independently.
- `shopify_settings` (single-row, id=1) — pre-seeded by migration `1761886500005_seed_shopify_settings_row.ts` to avoid a `firstOrCreate` race. Holds the Shopify location GID we sync against (auto-picked on first sync from the first active Shopify location) and last pull/push timestamps.
- `stock_movements.source` (string column) — distinguishes `manual` / `shopify_pull` / `shopify_push` so the audit history attributes each movement to its origin.

**Services**:

- `ShopifyClient` (`app/services/shopify_client.ts`) wraps the Admin GraphQL API. Module-scoped token cache + inflight-promise coalescing prevents thundering-herd mints. 401 on the GraphQL endpoint clears the cache and retries once (so rotated secrets / reinstalls self-heal). `setOnHandQuantities` chunks at 250 items per batch with a per-batch `randomUUID()` `referenceDocumentUri` for clean audit trails.
- `ShopifySyncService` (`app/services/shopify_sync_service.ts`) — the core sync logic. Three apply methods (`applyLink`, `applyPush`, `applyPull`, plus `applyUnlink`) and matching `build*Diff` methods. Each apply runs inside `withSyncLock` — a MySQL `GET_LOCK('shopify_sync', 5)` bound to the wrapping DB transaction so concurrent operators serialise on the same lock. The lock is released explicitly before the connection returns to the pool. **Never call link/push/pull writes outside `withSyncLock`** — atomicity guarantees depend on the lock+trx pair.
- `applyPull` algorithm: for each variant with linked mirrors, compute per-link delta vs `last_known_quantity`. Sum the negative deltas (sales) as `totalDecrement`. Deduct from a user-picked local location (via `StockService.adjust` with the same `trx`). Then auto-push the new local total to all mirrors so duplicates land in lockstep again — the auto-push runs after the pull commits (separate `withSyncLock` scope, reuses the existing Shopify snapshot to avoid a second catalog walk).
- Positive deltas (manual upward edits in Shopify admin) are ignored on pull — they're overwritten by the next push. Links with `null` `last_known_quantity` contribute 0 to deltas (the next push baselines them).
- **Wildcard pool folding**: `computeEffectiveTotals` produces `effective = own + Σ wildcard pool by (productId, colorId, sizeId)`, and both `buildPushDiff` and `applyPush` write that effective number to every linked Shopify mirror. Wildcards themselves are filtered out of all three diffs and `applyPush` defensively skips them even if a stale `ShopifyVariantLink` ever pointed at one — wildcards' stock travels to Shopify only through their derivatives. Pull math is unchanged for v1: a Shopify-side decrement still deducts from the printed variant's own stock at the operator-picked location, never from the wildcard pool. If the printed variant has zero own stock at every location but the pool was supplying it, pull fails and the operator must convert the wildcard first.

**HTTP shape**:

- `GET /sync` renders the page shell only — instant, no Shopify call.
- `GET /sync/diff` returns the full diff payload as JSON. The page fires this on mount and shows per-tab spinners until it resolves. After every apply, the page calls `loadDiff()` manually (Inertia reuses the component on redirect-to-same-URL, so `onMounted` doesn't re-fire automatically).
- `POST /sync/{link,unlink,push,pull}` — apply actions. All redirect back to `/sync` and flash a success/error message.

**Wire shapes**: contracts live in `shared/contracts/index.ts` under the `sync*` schemas. Sync rows carry a structured `display: { productName, color, size, imageUrl }` instead of opaque display strings — the page renders this via `SyncVariantCell`. SKU is not sent in sync rows (matching is by Shopify GID, not SKU).

**What's NOT synced**:

- Catalog metadata (name, description, price) — not in scope.
- New products in either direction — there's no "import from Shopify" or "push catalog up" flow. The local catalog is built manually via `/products/create` or `node ace db:seed`; Shopify variants are paired to existing locals on the Link tab.
- Images flow one way: pulled from Shopify into `variants.image_url` / `products.image_url` on first link (denormalised "canonical" image), used by the rest of the UI for thumbnails.

### Hot reload boundaries

`hotHook` in `package.json` marks `app/controllers/**` and `app/middleware/*` as HMR boundaries — edits there reload only the affected modules. Edits elsewhere (models, services, routes, validators, transformers) restart the process.

## Auth scoping caveat

There is **no per-user or per-tenant scoping** of inventory data. Every authenticated user can see and modify the same products, stocks, locations, and movements; `stock_movements.user_id` is purely an audit trail. This is why the public signup route was removed — accounts must be provisioned by an admin via `node ace user:create`. If you add multi-tenancy later, the cleanest path is a `workspaces` table + `workspace_id` FK on every domain table, scoped in each controller's base query.

The same applies to Shopify sync: the integration assumes one Shopify store per deployment, with credentials in `.env` and the chosen Shopify location stored on the single `shopify_settings` row. Multi-tenant Shopify sync would need `shopify_credentials` per workspace (probably a dedicated table) and per-workspace `shopify_variant_links` / `shopify_settings`.
