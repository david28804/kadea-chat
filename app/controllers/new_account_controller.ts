import User from '#models/user'
import EmailTokenService from '#services/email_token_service'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async store({ request, response, session, logger }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)
    const user = await User.create({ fullName, email, password })

    try {
      await EmailTokenService.sendConfirmation(user)
      session.flash('success', 'Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.')
    } catch (error) {
      logger.error({ err: error }, 'Échec envoi e-mail de confirmation')
      session.flash('error', "Compte créé, mais l'e-mail n'a pas pu être envoyé.")
    }

    return response.redirect().toRoute('session.create')
  }
}