import { DateTime } from 'luxon'
import User from '#models/user'
import EmailToken from '#models/email_token'
import EmailTokenService from '#services/email_token_service'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController handles user authentication and session management.
 * It provides methods for displaying the login page, authenticating users,
 * and logging out.
 */
export default class SessionController {
  /**
   * Display the login page
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Authenticate user credentials and create a new session
   */
  async store({ request, auth, response, session, logger }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)

    // Refuse la connexion tant que l'e-mail n'est pas confirmé,
    // et renvoie un lien de confirmation (au plus un toutes les 2 minutes)
    if (!user.emailVerifiedAt) {
      const recent = await EmailToken.query()
        .where('userId', user.id)
        .where('type', 'confirmation')
        .where('createdAt', '>', DateTime.now().minus({ minutes: 2 }).toSQL()!)
        .first()

      if (!recent) {
        try {
          await EmailTokenService.sendConfirmation(user)
        } catch (error) {
          logger.error({ err: error }, 'Échec renvoi e-mail de confirmation')
        }
      }

      session.flash(
        'error',
        "Confirmez d'abord votre adresse e-mail : nous venons de vous renvoyer le lien (pensez à regarder dans les spams)."
      )
      return response.redirect().toRoute('session.create')
    }

    await auth.use('web').login(user)
    return response.redirect().toRoute('dashboard')
  }

  /**
   * Log out the current user and destroy their session
   */
  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect().toRoute('home')
  }
}