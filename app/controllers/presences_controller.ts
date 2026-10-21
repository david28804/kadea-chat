import PresenceService from '#services/presence_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class PresencesController {
  /**
   * Reçoit le signe de vie d'un utilisateur connecté
   */
  async ping({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    PresenceService.touch(user.id)
    return response.noContent()
  }
}