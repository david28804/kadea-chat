import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Réserve une page aux administrateurs. Pour les autres, la page
 * n'existe pas (404) : on ne révèle pas qu'il y a une partie admin.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.auth.user?.isAdmin) {
      throw new Exception('Page introuvable', { status: 404 })
    }
    return next()
  }
}
