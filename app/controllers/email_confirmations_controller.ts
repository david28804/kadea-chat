import { DateTime } from 'luxon'
import EmailToken from '#models/email_token'
import EmailTokenService from '#services/email_token_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class EmailConfirmationsController {
  async handle({ params, response, session }: HttpContext) {
    const emailToken = await EmailToken.query()
      .where('tokenHash', EmailTokenService.hash(params.token))
      .where('type', 'confirmation')
      .preload('user')
      .first()

    if (!emailToken || emailToken.isUsed || emailToken.isExpired) {
      session.flash('error', 'Ce lien de confirmation est invalide ou a expiré.')
      return response.redirect().toRoute('session.create')
    }

    emailToken.user.emailVerifiedAt = DateTime.now()
    await emailToken.user.save()
    emailToken.usedAt = DateTime.now()
    await emailToken.save()

    session.flash('success', 'Adresse e-mail confirmée, vous pouvez vous connecter.')
    return response.redirect().toRoute('session.create')
  }
}