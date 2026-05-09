import type { Registry } from '@generated/registry/schema'

/**
 * Union of all registered route names. Sourced from the Tuyau registry that
 * Adonis regenerates whenever routes change, so adding a route automatically
 * widens this type.
 */
export type RouteName = keyof Registry
