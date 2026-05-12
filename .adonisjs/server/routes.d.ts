import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'stock.index': { paramsTuple?: []; params?: {} }
    'stock.index.alias': { paramsTuple?: []; params?: {} }
    'stock.adjust.create': { paramsTuple?: []; params?: {} }
    'stock.adjust': { paramsTuple?: []; params?: {} }
    'stock.adjust.bulk': { paramsTuple?: []; params?: {} }
    'stock.lookup.products': { paramsTuple: [ParamValue]; params: {'categoryId': ParamValue} }
    'stock.lookup.variants': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'stock.lookup.quantity': { paramsTuple: [ParamValue,ParamValue]; params: {'variantId': ParamValue,'locationId': ParamValue} }
    'stock.lookup.grid': { paramsTuple: [ParamValue,ParamValue]; params: {'productId': ParamValue,'locationId': ParamValue} }
    'movements.index': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.create': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'locations.index': { paramsTuple?: []; params?: {} }
    'locations.store': { paramsTuple?: []; params?: {} }
    'locations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'locations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'colors.index': { paramsTuple?: []; params?: {} }
    'colors.store': { paramsTuple?: []; params?: {} }
    'colors.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'colors.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sizes.index': { paramsTuple?: []; params?: {} }
    'sizes.store': { paramsTuple?: []; params?: {} }
    'sizes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sizes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sync.index': { paramsTuple?: []; params?: {} }
    'sync.diff': { paramsTuple?: []; params?: {} }
    'sync.link': { paramsTuple?: []; params?: {} }
    'sync.unlink': { paramsTuple?: []; params?: {} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'sync.pull': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'session.create': { paramsTuple?: []; params?: {} }
    'stock.index': { paramsTuple?: []; params?: {} }
    'stock.index.alias': { paramsTuple?: []; params?: {} }
    'stock.adjust.create': { paramsTuple?: []; params?: {} }
    'stock.lookup.products': { paramsTuple: [ParamValue]; params: {'categoryId': ParamValue} }
    'stock.lookup.variants': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'stock.lookup.quantity': { paramsTuple: [ParamValue,ParamValue]; params: {'variantId': ParamValue,'locationId': ParamValue} }
    'stock.lookup.grid': { paramsTuple: [ParamValue,ParamValue]; params: {'productId': ParamValue,'locationId': ParamValue} }
    'movements.index': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.create': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'locations.index': { paramsTuple?: []; params?: {} }
    'colors.index': { paramsTuple?: []; params?: {} }
    'sizes.index': { paramsTuple?: []; params?: {} }
    'sync.index': { paramsTuple?: []; params?: {} }
    'sync.diff': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'session.create': { paramsTuple?: []; params?: {} }
    'stock.index': { paramsTuple?: []; params?: {} }
    'stock.index.alias': { paramsTuple?: []; params?: {} }
    'stock.adjust.create': { paramsTuple?: []; params?: {} }
    'stock.lookup.products': { paramsTuple: [ParamValue]; params: {'categoryId': ParamValue} }
    'stock.lookup.variants': { paramsTuple: [ParamValue]; params: {'productId': ParamValue} }
    'stock.lookup.quantity': { paramsTuple: [ParamValue,ParamValue]; params: {'variantId': ParamValue,'locationId': ParamValue} }
    'stock.lookup.grid': { paramsTuple: [ParamValue,ParamValue]; params: {'productId': ParamValue,'locationId': ParamValue} }
    'movements.index': { paramsTuple?: []; params?: {} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.create': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'locations.index': { paramsTuple?: []; params?: {} }
    'colors.index': { paramsTuple?: []; params?: {} }
    'sizes.index': { paramsTuple?: []; params?: {} }
    'sync.index': { paramsTuple?: []; params?: {} }
    'sync.diff': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'stock.adjust': { paramsTuple?: []; params?: {} }
    'stock.adjust.bulk': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'locations.store': { paramsTuple?: []; params?: {} }
    'colors.store': { paramsTuple?: []; params?: {} }
    'sizes.store': { paramsTuple?: []; params?: {} }
    'sync.link': { paramsTuple?: []; params?: {} }
    'sync.unlink': { paramsTuple?: []; params?: {} }
    'sync.push': { paramsTuple?: []; params?: {} }
    'sync.pull': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'locations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'colors.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sizes.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'locations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'colors.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'sizes.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}