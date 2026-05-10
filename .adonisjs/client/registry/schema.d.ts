/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'stock.index': {
    methods: ["GET","HEAD"]
    pattern: '/stock'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock').stockIndexFiltersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.adjust.create': {
    methods: ["GET","HEAD"]
    pattern: '/stock/adjust'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['create']>>>
    }
  }
  'stock.adjust': {
    methods: ["POST"]
    pattern: '/stock/adjust'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock').adjustStockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock').adjustStockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['adjust']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['adjust']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.adjust.bulk': {
    methods: ["POST"]
    pattern: '/stock/adjust/bulk'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stock').bulkAdjustStockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stock').bulkAdjustStockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['bulkAdjust']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['bulkAdjust']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.lookup.products': {
    methods: ["GET","HEAD"]
    pattern: '/stock/lookup/categories/:categoryId/products'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { categoryId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock').stockLookupCategoryParamsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['productsForCategory']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['productsForCategory']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.lookup.variants': {
    methods: ["GET","HEAD"]
    pattern: '/stock/lookup/products/:productId/variants'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { productId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock').stockLookupProductParamsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['variantsForProduct']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['variantsForProduct']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.lookup.quantity': {
    methods: ["GET","HEAD"]
    pattern: '/stock/lookup/variants/:variantId/locations/:locationId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { variantId: ParamValue; locationId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock').stockLookupVariantParamsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['lookupStock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['lookupStock']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stock.lookup.grid': {
    methods: ["GET","HEAD"]
    pattern: '/stock/lookup/products/:productId/locations/:locationId/grid'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { productId: ParamValue; locationId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock').stockLookupGridParamsValidator)>|InferInput<(typeof import('#validators/stock').stockLookupGridQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['lookupGrid']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_controller').default['lookupGrid']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'movements.index': {
    methods: ["GET","HEAD"]
    pattern: '/movements'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/stock_movement').stockMovementFiltersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stock_movements_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
    }
  }
  'products.create': {
    methods: ["GET","HEAD"]
    pattern: '/products/create'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['create']>>>
    }
  }
  'products.store': {
    methods: ["POST"]
    pattern: '/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/product').createProductValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/product').createProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
    }
  }
  'products.edit': {
    methods: ["GET","HEAD"]
    pattern: '/products/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['edit']>>>
    }
  }
  'products.update': {
    methods: ["PUT"]
    pattern: '/products/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/product').updateProductValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/product').updateProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'products.destroy': {
    methods: ["DELETE"]
    pattern: '/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['destroy']>>>
    }
  }
  'categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['index']>>>
    }
  }
  'categories.store': {
    methods: ["POST"]
    pattern: '/categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/category').createCategoryValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/category').createCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.update': {
    methods: ["PUT"]
    pattern: '/categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/category').updateCategoryValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/category').updateCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'categories.destroy': {
    methods: ["DELETE"]
    pattern: '/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/categories_controller').default['destroy']>>>
    }
  }
  'locations.index': {
    methods: ["GET","HEAD"]
    pattern: '/locations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['index']>>>
    }
  }
  'locations.store': {
    methods: ["POST"]
    pattern: '/locations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/location').createLocationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/location').createLocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'locations.update': {
    methods: ["PUT"]
    pattern: '/locations/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/location').updateLocationValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/location').updateLocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'locations.destroy': {
    methods: ["DELETE"]
    pattern: '/locations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/locations_controller').default['destroy']>>>
    }
  }
  'colors.index': {
    methods: ["GET","HEAD"]
    pattern: '/colors'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['index']>>>
    }
  }
  'colors.store': {
    methods: ["POST"]
    pattern: '/colors'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/color').createColorValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/color').createColorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'colors.update': {
    methods: ["PUT"]
    pattern: '/colors/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/color').updateColorValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/color').updateColorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'colors.destroy': {
    methods: ["DELETE"]
    pattern: '/colors/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/colors_controller').default['destroy']>>>
    }
  }
  'prints.index': {
    methods: ["GET","HEAD"]
    pattern: '/prints'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['index']>>>
    }
  }
  'prints.store': {
    methods: ["POST"]
    pattern: '/prints'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/print').createPrintValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/print').createPrintValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'prints.update': {
    methods: ["PUT"]
    pattern: '/prints/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/print').updatePrintValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/print').updatePrintValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'prints.destroy': {
    methods: ["DELETE"]
    pattern: '/prints/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/prints_controller').default['destroy']>>>
    }
  }
  'sizes.index': {
    methods: ["GET","HEAD"]
    pattern: '/sizes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['index']>>>
    }
  }
  'sizes.store': {
    methods: ["POST"]
    pattern: '/sizes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/size').createSizeValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/size').createSizeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sizes.update': {
    methods: ["PUT"]
    pattern: '/sizes/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/size').updateSizeValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/size').updateSizeValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'sizes.destroy': {
    methods: ["DELETE"]
    pattern: '/sizes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sizes_controller').default['destroy']>>>
    }
  }
}
