import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import Location from '#models/location'
import LocationTransformer from '#transformers/location_transformer'
import ShopifySetting from '#models/shopify_setting'
import ShopifySyncService, { ShopifySyncError } from '#services/shopify_sync_service'
import { ShopifyClientError } from '#services/shopify_client'
import { isConfigured } from '#config/shopify'
import {
  syncLinkValidator,
  syncPullValidator,
  syncPushValidator,
  syncUnlinkValidator,
} from '#validators/sync'

/**
 * The /sync page is split in two:
 *
 *   GET /sync       → renders the shell only (configured flag + chrome).
 *                     Returns instantly, no Shopify call. The Vue page
 *                     fetches the diff JSON on mount and renders per-tab
 *                     spinners until it arrives.
 *
 *   GET /sync/diff  → returns the diff payload as JSON. This is where the
 *                     Shopify catalog walk happens — slow, but it no longer
 *                     blocks navigation to the page.
 *
 * The apply endpoints (link/push/pull) flash success/error and redirect
 * back to `/sync`, which means the diff re-fetches automatically.
 */
export default class SyncController {
  async index({ inertia }: HttpContext) {
    return inertia.render('sync/index', { configured: isConfigured() })
  }

  async diff(ctx: HttpContext) {
    const { response } = ctx
    if (!isConfigured()) {
      return response.json({ data: { configured: false } })
    }

    const service = new ShopifySyncService()
    try {
      // One Shopify catalog walk drives all three diffs. Calling the three
      // builders independently used to fire three parallel walks per page
      // load, tripling API cost and rate-limit pressure.
      const [diffs, locations, settings] = await Promise.all([
        service.buildAllDiffs(),
        Location.query().orderBy('name', 'asc'),
        ShopifySetting.find(1),
      ])
      const { link: linkDiff, push: pushDiff, pull: pullDiff } = diffs

      const resolvedLocations = await ctx.serialize.withoutWrapping(
        LocationTransformer.transform(locations)
      )

      return response.json({
        data: {
          configured: true,
          link: linkDiff,
          push: pushDiff,
          pull: pullDiff,
          locations: resolvedLocations,
          lastPullAt: settings?.lastPullAt?.toISO() ?? null,
          lastPushAt: settings?.lastPushAt?.toISO() ?? null,
        },
      })
    } catch (error) {
      logger.error({ err: error }, '[sync] diff build failed')
      // eslint-disable-next-line no-console
      console.error('[sync] diff build failed:', error)
      const detail = error instanceof Error ? error.message : String(error)
      return response.status(500).json({ error: `Sync failed: ${detail}` })
    }
  }

  async applyLink({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(syncLinkValidator)
    try {
      const result = await new ShopifySyncService().applyLink(payload.requests)
      session.flash('success', `Linked ${result.linked} Shopify variant(s).`)
    } catch (error) {
      session.flash('error', this.errorMessage(error))
    }
    return response.redirect().toRoute('sync.index')
  }

  async applyUnlink({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(syncUnlinkValidator)
    try {
      const result = await new ShopifySyncService().applyUnlink(payload.shopifyVariantIds)
      session.flash('success', `Unlinked ${result.unlinked} Shopify variant(s).`)
    } catch (error) {
      session.flash('error', this.errorMessage(error))
    }
    return response.redirect().toRoute('sync.index')
  }

  async applyPush({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(syncPushValidator)
    try {
      const result = await new ShopifySyncService().applyPush(payload.variantIds)
      session.flash('success', `Pushed ${result.pushed} variant(s) to Shopify.`)
    } catch (error) {
      session.flash('error', this.errorMessage(error))
    }
    return response.redirect().toRoute('sync.index')
  }

  async applyPull({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(syncPullValidator)
    const user = auth.user
    try {
      const result = await new ShopifySyncService().applyPull(
        payload.applications,
        user?.id ?? null
      )
      // Mention the auto-push count so the operator knows duplicates were
      // re-aligned (per design: pull + auto-push to keep mirrors in lockstep).
      const parts = [`Pulled ${result.adjusted} variant(s) from Shopify`]
      if (result.autoPushed > 0) {
        parts.push(`auto-pushed ${result.autoPushed} mirror(s) to re-align duplicates`)
      }
      session.flash('success', `${parts.join('; ')}.`)
    } catch (error) {
      session.flash('error', this.errorMessage(error))
    }
    return response.redirect().toRoute('sync.index')
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ShopifySyncError || error instanceof ShopifyClientError) {
      return error.message
    }
    return error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed.'
  }
}
