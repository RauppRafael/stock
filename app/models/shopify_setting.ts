import { ShopifySettingSchema } from '#database/schema'

/**
 * Single-row settings table — always read/written through `findOrFail(1)` or
 * `firstOrCreate({ id: 1 }, …)` so we never end up with multiple rows. The
 * sync flow lazily initialises the row on first use.
 */
export default class ShopifySetting extends ShopifySettingSchema {}
