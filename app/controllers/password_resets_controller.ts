import User from '#models/user'
import EmailToken from '#models/email_token'
import EmailTokenService from '#services/email_token_service'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

const forgotValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
  })
)

const resetValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export default class PasswordResetsController {
  /**
   * Affiche le formulaire "Mot de passe oublié"
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/forgot_password')
  }

  /**
   * Envoie l'e-mail de réinitialisation.
   * Le message est toujours le même, que l'e-mail existe ou non,
   * pour ne pas révéler quels comptes existent.
   */
  async store({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgotValidator)
    const user = await User.findBy('email', email)

    if (user) {
      try {
        await EmailTokenService.sendReset(user)
      } catch (error) {
        console.error('Échec envoi e-mail de réinitialisation', error)
      }
    }

    session.flash(
      'success',
      'Si cette adresse existe, un e-mail de réinitialisation vient de vous être envoyé.'
    )
    return response.redirect().toRoute('session.create')
  }

  /**
   * Affiche le formulaire "Nouveau mot de passe" si le lien est valide
   */
  async edit({ params, view, response, session }: HttpContext) {
    const emailToken = await this.findValidToken(params.token)

    if (!emailToken) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refaites une demande.')
      return response.redirect().toRoute('password.forgot')
    }

    return view.render('pages/auth/reset_password', { token: params.token })
  }

  /**
   * Enregistre le nouveau mot de passe
   */
  async update({ params, request, response, session }: HttpContext) {
    const { password } = await request.validateUsing(resetValidator)

    const tokenConsumed = await db.transaction(async (trx) => {
      const emailToken = await EmailToken.query({ client: trx })
        .where('tokenHash', EmailTokenService.hash(params.token))
        .where('type', 'reset')
        .whereNull('usedAt')
        .where('expiresAt', '>', DateTime.now().toJSDate())
        .forUpdate()
        .first()

      if (!emailToken) return false

      const user = await User.query({ client: trx }).where('id', emailToken.userId).firstOrFail()
      user.password = password
      user.useTransaction(trx)
      await user.save()

      emailToken.usedAt = DateTime.now()
      emailToken.useTransaction(trx)
      await emailToken.save()

      return true
    })

    if (!tokenConsumed) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refaites une demande.')
      return response.redirect().toRoute('password.forgot')
    }

    session.flash('success', 'Mot de passe modifié. Vous pouvez vous connecter.')
    return response.redirect().toRoute('session.create')
  }

  /**
   * Cherche un jeton "reset" valide (existant, non utilisé, non expiré)
   */
  private async findValidToken(token: string) {
    const emailToken = await EmailToken.query()
      .where('tokenHash', EmailTokenService.hash(token))
      .where('type', 'reset')
      .first()

    if (!emailToken || emailToken.isUsed || emailToken.isExpired) {
      return null
    }
    return emailToken
  }
}