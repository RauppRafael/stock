/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  stock: {
    index: typeof routes['stock.index']
    adjust: typeof routes['stock.adjust'] & {
      create: typeof routes['stock.adjust.create']
    }
    lookup: {
      products: typeof routes['stock.lookup.products']
      variants: typeof routes['stock.lookup.variants']
      quantity: typeof routes['stock.lookup.quantity']
    }
  }
  movements: {
    index: typeof routes['movements.index']
  }
  products: {
    index: typeof routes['products.index']
    create: typeof routes['products.create']
    store: typeof routes['products.store']
    show: typeof routes['products.show']
    edit: typeof routes['products.edit']
    update: typeof routes['products.update']
    destroy: typeof routes['products.destroy']
  }
  categories: {
    index: typeof routes['categories.index']
    store: typeof routes['categories.store']
    update: typeof routes['categories.update']
    destroy: typeof routes['categories.destroy']
  }
  locations: {
    index: typeof routes['locations.index']
    store: typeof routes['locations.store']
    update: typeof routes['locations.update']
    destroy: typeof routes['locations.destroy']
  }
  colors: {
    index: typeof routes['colors.index']
    store: typeof routes['colors.store']
    update: typeof routes['colors.update']
    destroy: typeof routes['colors.destroy']
  }
  prints: {
    index: typeof routes['prints.index']
    store: typeof routes['prints.store']
    update: typeof routes['prints.update']
    destroy: typeof routes['prints.destroy']
  }
  sizes: {
    index: typeof routes['sizes.index']
    store: typeof routes['sizes.store']
    update: typeof routes['sizes.update']
    destroy: typeof routes['sizes.destroy']
  }
}
