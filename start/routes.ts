/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

/**
 * Public auth — only login, no signup. Without per-user/per-tenant scoping,
 * a public signup route would let anyone create an account and edit
 * everyone else's data. Accounts are provisioned via `node ace user:create`,
 * `node ace user:edit`, or the catalog seeder.
 */
router
  .group(() => {
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])

    /**
     * Stock dashboard + adjustment flow. `/` is the canonical URL; `/stock`
     * stays as an alias so existing bookmarks and the few in-app references
     * (the filter-debounce `router.get('/stock', ...)` and the sidebar
     * active-state match pattern) keep working. The alias route name is
     * unused — it's only set because Adonis would otherwise auto-derive a
     * name colliding with `stock.index`.
     */
    router.get('/', [controllers.Stock, 'index']).as('stock.index')
    router.get('/stock', [controllers.Stock, 'index']).as('stock.index.alias')
    router.get('/stock/adjust', [controllers.Stock, 'create']).as('stock.adjust.create')
    router.post('/stock/adjust', [controllers.Stock, 'adjust']).as('stock.adjust')
    router.post('/stock/adjust/bulk', [controllers.Stock, 'bulkAdjust']).as('stock.adjust.bulk')
    router
      .get('/stock/lookup/categories/:categoryId/products', [
        controllers.Stock,
        'productsForCategory',
      ])
      .as('stock.lookup.products')
    router
      .get('/stock/lookup/products/:productId/variants', [controllers.Stock, 'variantsForProduct'])
      .as('stock.lookup.variants')
    router
      .get('/stock/lookup/variants/:variantId/locations/:locationId', [
        controllers.Stock,
        'lookupStock',
      ])
      .as('stock.lookup.quantity')
    router
      .get('/stock/lookup/products/:productId/locations/:locationId/grid', [
        controllers.Stock,
        'lookupGrid',
      ])
      .as('stock.lookup.grid')

    /**
     * Movement history
     */
    router.get('/movements', [controllers.StockMovements, 'index']).as('movements.index')

    /**
     * Catalog CRUD
     */
    router.get('/products', [controllers.Products, 'index']).as('products.index')
    router.get('/products/create', [controllers.Products, 'create']).as('products.create')
    router.post('/products', [controllers.Products, 'store']).as('products.store')
    router.get('/products/:id', [controllers.Products, 'show']).as('products.show')
    router.get('/products/:id/edit', [controllers.Products, 'edit']).as('products.edit')
    router.put('/products/:id', [controllers.Products, 'update']).as('products.update')
    router.delete('/products/:id', [controllers.Products, 'destroy']).as('products.destroy')

    router.get('/categories', [controllers.Categories, 'index']).as('categories.index')
    router.post('/categories', [controllers.Categories, 'store']).as('categories.store')
    router.put('/categories/:id', [controllers.Categories, 'update']).as('categories.update')
    router.delete('/categories/:id', [controllers.Categories, 'destroy']).as('categories.destroy')

    router.get('/locations', [controllers.Locations, 'index']).as('locations.index')
    router.post('/locations', [controllers.Locations, 'store']).as('locations.store')
    router.put('/locations/:id', [controllers.Locations, 'update']).as('locations.update')
    router.delete('/locations/:id', [controllers.Locations, 'destroy']).as('locations.destroy')

    router.get('/colors', [controllers.Colors, 'index']).as('colors.index')
    router.post('/colors', [controllers.Colors, 'store']).as('colors.store')
    router.put('/colors/:id', [controllers.Colors, 'update']).as('colors.update')
    router.delete('/colors/:id', [controllers.Colors, 'destroy']).as('colors.destroy')

    router.get('/sizes', [controllers.Sizes, 'index']).as('sizes.index')
    router.post('/sizes', [controllers.Sizes, 'store']).as('sizes.store')
    router.put('/sizes/:id', [controllers.Sizes, 'update']).as('sizes.update')
    router.delete('/sizes/:id', [controllers.Sizes, 'destroy']).as('sizes.destroy')

    /**
     * Shopify sync. `index` renders the page shell instantly; the diff
     * payload is fetched async from `sync.diff` so the user isn't blocked
     * by the Shopify catalog walk. `link`/`push`/`pull` apply ticked rows.
     */
    router.get('/sync', [controllers.Sync, 'index']).as('sync.index')
    router.get('/sync/diff', [controllers.Sync, 'diff']).as('sync.diff')
    router.post('/sync/link', [controllers.Sync, 'applyLink']).as('sync.link')
    router.post('/sync/unlink', [controllers.Sync, 'applyUnlink']).as('sync.unlink')
    router.post('/sync/push', [controllers.Sync, 'applyPush']).as('sync.push')
    router.post('/sync/pull', [controllers.Sync, 'applyPull']).as('sync.pull')
  })
  .use(middleware.auth())
