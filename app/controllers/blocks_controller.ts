import User from '#models/user'
import BlockedUser from '#models/blocked_user'
import type { HttpContext } from '@adonisjs/core/http'

export default class BlocksController {
  /**
   * Bloque un utilisateur
   */
  async store({ auth, params, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const otherId = Number(params.id)

    if (!Number.isInteger(otherId) || otherId === me.id) {
      session.flash('error', 'Utilisateur invalide.')
      return response.redirect().back()
    }

    const other = await User.find(otherId)
    if (!other) {
      session.flash('error', 'Utilisateur introuvable.')
      return response.redirect().back()
    }

    await BlockedUser.firstOrCreate({ blockerId: me.id, blockedId: other.id })

    session.flash('success', `${other.fullName ?? other.email} est bloqué(e).`)
    return response.redirect().back()
  }

  /**
   * Débloque un utilisateur
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const otherId = Number(params.id)

    if (!Number.isInteger(otherId)) {
      session.flash('error', 'Utilisateur invalide.')
      return response.redirect().back()
    }

    await BlockedUser.query().where('blockerId', me.id).where('blockedId', otherId).delete()

    session.flash('success', 'Utilisateur débloqué.')
    return response.redirect().back()
  }
}