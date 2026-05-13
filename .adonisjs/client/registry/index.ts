/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'stock.index': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['stock.index']['types'],
  },
  'stock.index.alias': {
    methods: ["GET","HEAD"],
    pattern: '/stock',
    tokens: [{"old":"/stock","type":0,"val":"stock","end":""}],
    types: placeholder as Registry['stock.index.alias']['types'],
  },
  'stock.adjust.create': {
    methods: ["GET","HEAD"],
    pattern: '/stock/adjust',
    tokens: [{"old":"/stock/adjust","type":0,"val":"stock","end":""},{"old":"/stock/adjust","type":0,"val":"adjust","end":""}],
    types: placeholder as Registry['stock.adjust.create']['types'],
  },
  'stock.adjust': {
    methods: ["POST"],
    pattern: '/stock/adjust',
    tokens: [{"old":"/stock/adjust","type":0,"val":"stock","end":""},{"old":"/stock/adjust","type":0,"val":"adjust","end":""}],
    types: placeholder as Registry['stock.adjust']['types'],
  },
  'stock.adjust.bulk': {
    methods: ["POST"],
    pattern: '/stock/adjust/bulk',
    tokens: [{"old":"/stock/adjust/bulk","type":0,"val":"stock","end":""},{"old":"/stock/adjust/bulk","type":0,"val":"adjust","end":""},{"old":"/stock/adjust/bulk","type":0,"val":"bulk","end":""}],
    types: placeholder as Registry['stock.adjust.bulk']['types'],
  },
  'stock.convert.create': {
    methods: ["GET","HEAD"],
    pattern: '/stock/convert',
    tokens: [{"old":"/stock/convert","type":0,"val":"stock","end":""},{"old":"/stock/convert","type":0,"val":"convert","end":""}],
    types: placeholder as Registry['stock.convert.create']['types'],
  },
  'stock.convert': {
    methods: ["POST"],
    pattern: '/stock/convert',
    tokens: [{"old":"/stock/convert","type":0,"val":"stock","end":""},{"old":"/stock/convert","type":0,"val":"convert","end":""}],
    types: placeholder as Registry['stock.convert']['types'],
  },
  'stock.lookup.wildcardTargets': {
    methods: ["GET","HEAD"],
    pattern: '/stock/lookup/wildcards/:wildcardVariantId/targets',
    tokens: [{"old":"/stock/lookup/wildcards/:wildcardVariantId/targets","type":0,"val":"stock","end":""},{"old":"/stock/lookup/wildcards/:wildcardVariantId/targets","type":0,"val":"lookup","end":""},{"old":"/stock/lookup/wildcards/:wildcardVariantId/targets","type":0,"val":"wildcards","end":""},{"old":"/stock/lookup/wildcards/:wildcardVariantId/targets","type":1,"val":"wildcardVariantId","end":""},{"old":"/stock/lookup/wildcards/:wildcardVariantId/targets","type":0,"val":"targets","end":""}],
    types: placeholder as Registry['stock.lookup.wildcardTargets']['types'],
  },
  'stock.lookup.products': {
    methods: ["GET","HEAD"],
    pattern: '/stock/lookup/categories/:categoryId/products',
    tokens: [{"old":"/stock/lookup/categories/:categoryId/products","type":0,"val":"stock","end":""},{"old":"/stock/lookup/categories/:categoryId/products","type":0,"val":"lookup","end":""},{"old":"/stock/lookup/categories/:categoryId/products","type":0,"val":"categories","end":""},{"old":"/stock/lookup/categories/:categoryId/products","type":1,"val":"categoryId","end":""},{"old":"/stock/lookup/categories/:categoryId/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['stock.lookup.products']['types'],
  },
  'stock.lookup.variants': {
    methods: ["GET","HEAD"],
    pattern: '/stock/lookup/products/:productId/variants',
    tokens: [{"old":"/stock/lookup/products/:productId/variants","type":0,"val":"stock","end":""},{"old":"/stock/lookup/products/:productId/variants","type":0,"val":"lookup","end":""},{"old":"/stock/lookup/products/:productId/variants","type":0,"val":"products","end":""},{"old":"/stock/lookup/products/:productId/variants","type":1,"val":"productId","end":""},{"old":"/stock/lookup/products/:productId/variants","type":0,"val":"variants","end":""}],
    types: placeholder as Registry['stock.lookup.variants']['types'],
  },
  'stock.lookup.quantity': {
    methods: ["GET","HEAD"],
    pattern: '/stock/lookup/variants/:variantId/locations/:locationId',
    tokens: [{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":0,"val":"stock","end":""},{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":0,"val":"lookup","end":""},{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":0,"val":"variants","end":""},{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":1,"val":"variantId","end":""},{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":0,"val":"locations","end":""},{"old":"/stock/lookup/variants/:variantId/locations/:locationId","type":1,"val":"locationId","end":""}],
    types: placeholder as Registry['stock.lookup.quantity']['types'],
  },
  'stock.lookup.grid': {
    methods: ["GET","HEAD"],
    pattern: '/stock/lookup/products/:productId/locations/:locationId/grid',
    tokens: [{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":0,"val":"stock","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":0,"val":"lookup","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":0,"val":"products","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":1,"val":"productId","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":0,"val":"locations","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":1,"val":"locationId","end":""},{"old":"/stock/lookup/products/:productId/locations/:locationId/grid","type":0,"val":"grid","end":""}],
    types: placeholder as Registry['stock.lookup.grid']['types'],
  },
  'movements.index': {
    methods: ["GET","HEAD"],
    pattern: '/movements',
    tokens: [{"old":"/movements","type":0,"val":"movements","end":""}],
    types: placeholder as Registry['movements.index']['types'],
  },
  'products.index': {
    methods: ["GET","HEAD"],
    pattern: '/products',
    tokens: [{"old":"/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.index']['types'],
  },
  'products.create': {
    methods: ["GET","HEAD"],
    pattern: '/products/create',
    tokens: [{"old":"/products/create","type":0,"val":"products","end":""},{"old":"/products/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['products.create']['types'],
  },
  'products.store': {
    methods: ["POST"],
    pattern: '/products',
    tokens: [{"old":"/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.store']['types'],
  },
  'products.show': {
    methods: ["GET","HEAD"],
    pattern: '/products/:id',
    tokens: [{"old":"/products/:id","type":0,"val":"products","end":""},{"old":"/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.show']['types'],
  },
  'products.edit': {
    methods: ["GET","HEAD"],
    pattern: '/products/:id/edit',
    tokens: [{"old":"/products/:id/edit","type":0,"val":"products","end":""},{"old":"/products/:id/edit","type":1,"val":"id","end":""},{"old":"/products/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['products.edit']['types'],
  },
  'products.update': {
    methods: ["PUT"],
    pattern: '/products/:id',
    tokens: [{"old":"/products/:id","type":0,"val":"products","end":""},{"old":"/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.update']['types'],
  },
  'products.destroy': {
    methods: ["DELETE"],
    pattern: '/products/:id',
    tokens: [{"old":"/products/:id","type":0,"val":"products","end":""},{"old":"/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.destroy']['types'],
  },
  'categories.index': {
    methods: ["GET","HEAD"],
    pattern: '/categories',
    tokens: [{"old":"/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.index']['types'],
  },
  'categories.store': {
    methods: ["POST"],
    pattern: '/categories',
    tokens: [{"old":"/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.store']['types'],
  },
  'categories.update': {
    methods: ["PUT"],
    pattern: '/categories/:id',
    tokens: [{"old":"/categories/:id","type":0,"val":"categories","end":""},{"old":"/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.update']['types'],
  },
  'categories.destroy': {
    methods: ["DELETE"],
    pattern: '/categories/:id',
    tokens: [{"old":"/categories/:id","type":0,"val":"categories","end":""},{"old":"/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.destroy']['types'],
  },
  'locations.index': {
    methods: ["GET","HEAD"],
    pattern: '/locations',
    tokens: [{"old":"/locations","type":0,"val":"locations","end":""}],
    types: placeholder as Registry['locations.index']['types'],
  },
  'locations.store': {
    methods: ["POST"],
    pattern: '/locations',
    tokens: [{"old":"/locations","type":0,"val":"locations","end":""}],
    types: placeholder as Registry['locations.store']['types'],
  },
  'locations.update': {
    methods: ["PUT"],
    pattern: '/locations/:id',
    tokens: [{"old":"/locations/:id","type":0,"val":"locations","end":""},{"old":"/locations/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['locations.update']['types'],
  },
  'locations.destroy': {
    methods: ["DELETE"],
    pattern: '/locations/:id',
    tokens: [{"old":"/locations/:id","type":0,"val":"locations","end":""},{"old":"/locations/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['locations.destroy']['types'],
  },
  'colors.index': {
    methods: ["GET","HEAD"],
    pattern: '/colors',
    tokens: [{"old":"/colors","type":0,"val":"colors","end":""}],
    types: placeholder as Registry['colors.index']['types'],
  },
  'colors.store': {
    methods: ["POST"],
    pattern: '/colors',
    tokens: [{"old":"/colors","type":0,"val":"colors","end":""}],
    types: placeholder as Registry['colors.store']['types'],
  },
  'colors.update': {
    methods: ["PUT"],
    pattern: '/colors/:id',
    tokens: [{"old":"/colors/:id","type":0,"val":"colors","end":""},{"old":"/colors/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['colors.update']['types'],
  },
  'colors.destroy': {
    methods: ["DELETE"],
    pattern: '/colors/:id',
    tokens: [{"old":"/colors/:id","type":0,"val":"colors","end":""},{"old":"/colors/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['colors.destroy']['types'],
  },
  'sizes.index': {
    methods: ["GET","HEAD"],
    pattern: '/sizes',
    tokens: [{"old":"/sizes","type":0,"val":"sizes","end":""}],
    types: placeholder as Registry['sizes.index']['types'],
  },
  'sizes.store': {
    methods: ["POST"],
    pattern: '/sizes',
    tokens: [{"old":"/sizes","type":0,"val":"sizes","end":""}],
    types: placeholder as Registry['sizes.store']['types'],
  },
  'sizes.update': {
    methods: ["PUT"],
    pattern: '/sizes/:id',
    tokens: [{"old":"/sizes/:id","type":0,"val":"sizes","end":""},{"old":"/sizes/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['sizes.update']['types'],
  },
  'sizes.destroy': {
    methods: ["DELETE"],
    pattern: '/sizes/:id',
    tokens: [{"old":"/sizes/:id","type":0,"val":"sizes","end":""},{"old":"/sizes/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['sizes.destroy']['types'],
  },
  'sync.index': {
    methods: ["GET","HEAD"],
    pattern: '/sync',
    tokens: [{"old":"/sync","type":0,"val":"sync","end":""}],
    types: placeholder as Registry['sync.index']['types'],
  },
  'sync.diff': {
    methods: ["GET","HEAD"],
    pattern: '/sync/diff',
    tokens: [{"old":"/sync/diff","type":0,"val":"sync","end":""},{"old":"/sync/diff","type":0,"val":"diff","end":""}],
    types: placeholder as Registry['sync.diff']['types'],
  },
  'sync.link': {
    methods: ["POST"],
    pattern: '/sync/link',
    tokens: [{"old":"/sync/link","type":0,"val":"sync","end":""},{"old":"/sync/link","type":0,"val":"link","end":""}],
    types: placeholder as Registry['sync.link']['types'],
  },
  'sync.unlink': {
    methods: ["POST"],
    pattern: '/sync/unlink',
    tokens: [{"old":"/sync/unlink","type":0,"val":"sync","end":""},{"old":"/sync/unlink","type":0,"val":"unlink","end":""}],
    types: placeholder as Registry['sync.unlink']['types'],
  },
  'sync.push': {
    methods: ["POST"],
    pattern: '/sync/push',
    tokens: [{"old":"/sync/push","type":0,"val":"sync","end":""},{"old":"/sync/push","type":0,"val":"push","end":""}],
    types: placeholder as Registry['sync.push']['types'],
  },
  'sync.pull': {
    methods: ["POST"],
    pattern: '/sync/pull',
    tokens: [{"old":"/sync/pull","type":0,"val":"sync","end":""},{"old":"/sync/pull","type":0,"val":"pull","end":""}],
    types: placeholder as Registry['sync.pull']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
