import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Color from '#models/color'
import Print from '#models/print'
import Size from '#models/size'
import Location from '#models/location'
import Product from '#models/product'
import Variant from '#models/variant'

type CategoryDef = {
  name: string
  icon: string
  hasColor: boolean
  hasPrint: boolean
  hasSize: boolean
}

type ProductDef = {
  name: string
  code: string
  category: string
  description?: string
  lowStockThreshold?: number
  colors?: string[]
  prints?: string[]
  sizes?: string[]
}

const CATEGORIES: CategoryDef[] = [
  { name: 'Hoodie', icon: '🧥', hasColor: true, hasPrint: true, hasSize: true },
  { name: 'Skirt', icon: '👗', hasColor: true, hasPrint: false, hasSize: true },
  { name: 'Dress', icon: '👚', hasColor: true, hasPrint: true, hasSize: true },
  { name: 'T-Shirt', icon: '👕', hasColor: true, hasPrint: true, hasSize: true },
  { name: 'Tank Top', icon: '🎽', hasColor: true, hasPrint: false, hasSize: true },
  { name: 'Hat', icon: '🧢', hasColor: true, hasPrint: true, hasSize: false },
]

const COLORS: { name: string; code: string; hexCode: string | null }[] = [
  { name: 'Nude', code: 'NUDE', hexCode: '#E3BC9A' },
  { name: 'Black', code: 'BLK', hexCode: '#111111' },
  { name: 'White', code: 'WHT', hexCode: '#FAFAFA' },
  { name: 'Olive', code: 'OLV', hexCode: '#708238' },
  { name: 'Burgundy', code: 'BRG', hexCode: '#800020' },
  { name: 'Sky Blue', code: 'SKY', hexCode: '#87CEEB' },
]

const PRINTS: { name: string; code: string }[] = [
  { name: 'Plain', code: 'PL' },
  { name: 'Puff', code: 'PUFF' },
  { name: 'Floral', code: 'FLR' },
  { name: 'Stripe', code: 'STR' },
  { name: 'Logo', code: 'LOGO' },
]

const SIZES: { name: string; code: string; sortOrder: number }[] = [
  { name: 'XS', code: 'XS', sortOrder: 10 },
  { name: 'S', code: 'S', sortOrder: 20 },
  { name: 'M', code: 'M', sortOrder: 30 },
  { name: 'L', code: 'L', sortOrder: 40 },
  { name: 'XL', code: 'XL', sortOrder: 50 },
  { name: 'One Size', code: 'OS', sortOrder: 99 },
]

const LOCATIONS: { name: string; description: string }[] = [
  { name: 'Main Warehouse', description: 'Primary fulfillment center' },
  { name: 'Pop-up Store', description: 'Downtown retail location' },
]

const PRODUCTS: ProductDef[] = [
  {
    name: 'Fold Hoodie',
    code: 'FLDH',
    category: 'Hoodie',
    description: 'Heavyweight hoodie with folded hem.',
    lowStockThreshold: 5,
    colors: ['Nude', 'Black', 'Olive'],
    prints: ['Plain', 'Puff'],
    sizes: ['S', 'M', 'L'],
  },
  {
    name: 'Pleated Skirt',
    code: 'PLTS',
    category: 'Skirt',
    description: 'Mid-length pleated skirt.',
    lowStockThreshold: 3,
    colors: ['Black', 'Burgundy'],
    sizes: ['XS', 'S', 'M', 'L'],
  },
  {
    name: 'Bucket Hat',
    code: 'BCKT',
    category: 'Hat',
    lowStockThreshold: 4,
    colors: ['Black', 'White'],
    prints: ['Plain', 'Logo'],
  },
  {
    name: 'Boxy Tee',
    code: 'BOXT',
    category: 'T-Shirt',
    lowStockThreshold: 6,
    colors: ['White', 'Black', 'Sky Blue'],
    prints: ['Plain', 'Floral'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
]

export default class extends BaseSeeder {
  async run() {
    const categories = await this.upsertCategories()
    const colors = await this.upsertColors()
    const prints = await this.upsertPrints()
    const sizes = await this.upsertSizes()
    await this.upsertLocations()

    for (const def of PRODUCTS) {
      const category = categories.get(def.category)
      if (!category) continue

      const product = await Product.updateOrCreate(
        { code: def.code },
        {
          name: def.name,
          code: def.code,
          categoryId: category.id,
          description: def.description ?? null,
          lowStockThreshold: def.lowStockThreshold ?? null,
        }
      )

      const colorList = category.hasColor
        ? (def.colors ?? []).map((n) => colors.get(n)).filter((c): c is NonNullable<typeof c> => !!c)
        : [null]
      const printList = category.hasPrint
        ? (def.prints ?? []).map((n) => prints.get(n)).filter((p): p is NonNullable<typeof p> => !!p)
        : [null]
      const sizeList = category.hasSize
        ? (def.sizes ?? []).map((n) => sizes.get(n)).filter((s): s is NonNullable<typeof s> => !!s)
        : [null]

      for (const color of colorList) {
        for (const print of printList) {
          for (const size of sizeList) {
            await Variant.firstOrCreate(
              {
                productId: product.id,
                colorId: color?.id ?? null,
                printId: print?.id ?? null,
                sizeId: size?.id ?? null,
              },
              {
                productId: product.id,
                colorId: color?.id ?? null,
                printId: print?.id ?? null,
                sizeId: size?.id ?? null,
              }
            )
          }
        }
      }
    }
  }

  private async upsertCategories(): Promise<Map<string, Category>> {
    const map = new Map<string, Category>()
    for (const def of CATEGORIES) {
      const category = await Category.updateOrCreate({ name: def.name }, def)
      map.set(category.name, category)
    }
    return map
  }

  private async upsertColors(): Promise<Map<string, Color>> {
    const map = new Map<string, Color>()
    for (const def of COLORS) {
      const color = await Color.updateOrCreate({ name: def.name }, def)
      map.set(color.name, color)
    }
    return map
  }

  private async upsertPrints(): Promise<Map<string, Print>> {
    const map = new Map<string, Print>()
    for (const def of PRINTS) {
      const print = await Print.updateOrCreate({ name: def.name }, def)
      map.set(print.name, print)
    }
    return map
  }

  private async upsertSizes(): Promise<Map<string, Size>> {
    const map = new Map<string, Size>()
    for (const def of SIZES) {
      const size = await Size.updateOrCreate({ name: def.name }, def)
      map.set(size.name, size)
    }
    return map
  }

  private async upsertLocations(): Promise<Map<string, Location>> {
    const map = new Map<string, Location>()
    for (const def of LOCATIONS) {
      const location = await Location.updateOrCreate({ name: def.name }, def)
      map.set(location.name, location)
    }
    return map
  }
}
