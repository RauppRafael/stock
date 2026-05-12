/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database (MySQL)
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  DB_DEBUG: Env.schema.boolean.optional(),

  // Default user created by `node ace db:seed`. Optional — falls back to
  // sensible local-dev values when omitted.
  SEED_USER_EMAIL: Env.schema.string.optional({ format: 'email' }),
  SEED_USER_PASSWORD: Env.schema.string.optional(),
  SEED_USER_NAME: Env.schema.string.optional(),

  // Shopify Admin API. Optional so the app boots without Shopify configured;
  // the /sync page surfaces a "not configured" empty state when these are
  // missing, instead of crashing on first request.
  //
  // Since Jan 2026 Shopify retired the legacy `shpat_` permanent token. New
  // apps go through the Dev Dashboard and authenticate via the client
  // credentials grant — we exchange the client_id + client_secret for a 24h
  // access token at runtime (handled in `ShopifyClient.ensureAccessToken`).
  SHOPIFY_SHOP_DOMAIN: Env.schema.string.optional(),
  SHOPIFY_CLIENT_ID: Env.schema.string.optional(),
  SHOPIFY_CLIENT_SECRET: Env.schema.string.optional(),
  SHOPIFY_API_VERSION: Env.schema.string.optional(),
})
