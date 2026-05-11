import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Color from '#models/color'
import Size from '#models/size'
import Location from '#models/location'
import Product from '#models/product'
import Variant from '#models/variant'

type CategoryDef = {
  name: string
  icon: string
  hasColor: boolean
  hasSize: boolean
}

type ProductDef = {
  name: string
  code: string
  category: string
  description?: string
  lowStockThreshold?: number
  colors?: string[]
  sizes?: string[]
}

const CATEGORIES: CategoryDef[] = [
  { name: 'Hoodie', icon: '🧥', hasColor: true, hasSize: true },
  { name: 'Skirt', icon: '👗', hasColor: true, hasSize: true },
  { name: 'Dress', icon: '👚', hasColor: true, hasSize: true },
  { name: 'T-Shirt', icon: '👕', hasColor: true, hasSize: true },
  { name: 'Tank Top', icon: '🎽', hasColor: true, hasSize: true },
  { name: 'Hat', icon: '🧢', hasColor: true, hasSize: false },
]

const COLORS: { name: string; code: string; hexCode: string | null }[] = [
  { name: 'Nude', code: 'NUDE', hexCode: '#E3BC9A' },
  { name: 'Black', code: 'BLK', hexCode: '#111111' },
  { name: 'White', code: 'WHT', hexCode: '#FAFAFA' },
  { name: 'Olive', code: 'OLV', hexCode: '#708238' },
  { name: 'Burgundy', code: 'BRG', hexCode: '#800020' },
  { name: 'Sky Blue', code: 'SKY', hexCode: '#87CEEB' },
]

const SIZES: { name: string; code: string; sortOrder: number }[] = [
  { name: 'XS', code: 'XS', sortOrder: 10 },
  { name: 'S', code: 'S', sortOrder: 20 },
  { name: 'M', code: 'M', sortOrder: 30 },
  { name: 'L', code: 'L', sortOrder: 40 },
  { name: 'XL', code: 'XL', sortOrder: 50 },
  { name: 'One Size', code: 'OS', sortOrder: 99 },
]

const LOCATIONS: { name: string; description: string; icon: string }[] = [
  { name: 'Main Warehouse', description: 'Primary fulfillment center', icon: '🏭' },
  { name: 'Pop-up Store', description: 'Downtown retail location', icon: '🏪' },
]

/**
 * Print is folded into the product name itself — a "Fold Hoodie Plain" and
 * a "Fold Hoodie Puff" are two distinct products in the catalog, not a
 * single product with a print axis.
 */
const PRODUCTS: ProductDef[] = [
  {
    name: 'Fold Hoodie Plain',
    code: 'FLDH-PL',
    category: 'Hoodie',
    description: 'Heavyweight hoodie with folded hem.',
    lowStockThreshold: 5,
    colors: ['Nude', 'Black', 'Olive'],
    sizes: ['S', 'M', 'L'],
  },
  {
    name: 'Fold Hoodie Puff',
    code: 'FLDH-PUFF',
    category: 'Hoodie',
    description: 'Heavyweight hoodie with folded hem and puff-print graphic.',
    lowStockThreshold: 5,
    colors: ['Nude', 'Black', 'Olive'],
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
    name: 'Bucket Hat Plain',
    code: 'BCKT-PL',
    category: 'Hat',
    lowStockThreshold: 4,
    colors: ['Black', 'White'],
  },
  {
    name: 'Bucket Hat Logo',
    code: 'BCKT-LOGO',
    category: 'Hat',
    lowStockThreshold: 4,
    colors: ['Black', 'White'],
  },
  {
    name: 'Boxy Tee Plain',
    code: 'BOXT-PL',
    category: 'T-Shirt',
    lowStockThreshold: 6,
    colors: ['White', 'Black', 'Sky Blue'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    name: 'Boxy Tee Floral',
    code: 'BOXT-FLR',
    category: 'T-Shirt',
    lowStockThreshold: 6,
    colors: ['White', 'Black', 'Sky Blue'],
    sizes: ['S', 'M', 'L', 'XL'],
  },
]

export default class extends BaseSeeder {
  async run() {
    const categories = await this.upsertCategories()
    const colors = await this.upsertColors()
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
        ? (def.colors ?? [])
            .map((n) => colors.get(n))
            .filter((c): c is NonNullable<typeof c> => !!c)
        : [null]
      const sizeList = category.hasSize
        ? (def.sizes ?? []).map((n) => sizes.get(n)).filter((s): s is NonNullable<typeof s> => !!s)
        : [null]

      for (const color of colorList) {
        for (const size of sizeList) {
          await Variant.firstOrCreate(
            {
              productId: product.id,
              colorId: color?.id ?? null,
              sizeId: size?.id ?? null,
            },
            {
              productId: product.id,
              colorId: color?.id ?? null,
              sizeId: size?.id ?? null,
            }
          )
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
