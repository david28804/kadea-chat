import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Silent auth middleware can be used as a global middleware to silent check
 * if the user is logged-in or not.
 *
 * The request continues as usual, even when the user is not logged-in.
 */
export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()

    // Une session ouverte avant la déconnexion forcée par un administrateur n'est plus valable
    const revokedAt = ctx.auth.user?.sessionsRevokedAt
    if (revokedAt && Number(ctx.session.get('logged_in_at', 0)) < revokedAt.toMillis()) {
      await ctx.auth.use('web').logout()
    }

    return next()
  }
}
