import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserTransformer from '#transformers/user_transformer'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { InertiaHeaders } from '@adonisjs/inertia'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  /**
   * The base implementation wraps validation errors under the request's
   * `X-Inertia-Error-Bag` header even when there are no errors. That gives
   * Inertia a non-empty `errors` prop (e.g. `{ category: {} }`), which it
   * counts as "errors are present" and so it dispatches `onError` instead of
   * `onSuccess`. We skip the wrap when the bag would be empty so success
   * callbacks (e.g. modal-close after inline-create) actually fire.
   */
  getValidationErrors(ctx: HttpContext) {
    const errors = super.getValidationErrors(ctx)
    const errorBag = ctx.request.header(InertiaHeaders.ErrorBag)
    if (errorBag && errorBag in errors) {
      const bag = (errors as Record<string, Record<string, string>>)[errorBag]
      if (Object.keys(bag).length === 0) return {}
    }
    return errors
  }

  share(ctx: HttpContext) {
    /**
     * The share method is called everytime an Inertia page is rendered. In
     * certain cases, a page may get rendered before the session middleware
     * or the auth middleware are executed. For example: During a 404 request.
     *
     * In that case, we must always assume that HttpContext is not fully hydrated
     * with all the properties
     */
    const { session, auth } = ctx as Partial<HttpContext>

    /**
     * Fetching the first error from the flash messages
     */
    const error = session?.flashMessages.get('error') as string
    const success = session?.flashMessages.get('success') as string

    /**
     * Data shared with all Inertia pages. Make sure you are using
     * transformers for rich data-types like Models.
     */
    return {
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      flash: ctx.inertia.always({
        error,
        success,
      }),
      user: ctx.inertia.always(auth?.user ? UserTransformer.transform(auth.user) : undefined),
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
