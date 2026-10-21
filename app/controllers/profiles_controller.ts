import User from '#models/user'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'

const profileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(80),
  })
)

const passwordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    password: vine.string().minLength(8),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

export default class ProfilesController {
  /**
   * Affiche la page "Mon profil"
   */
  async edit({ auth, view }: HttpContext) {
    const me = auth.getUserOrFail()
    return view.render('pages/profile/edit', { me })
  }

  /**
   * Enregistre le nom complet
   */
  async update({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { fullName } = await request.validateUsing(profileValidator)

    me.fullName = fullName
    await me.save()

    session.flash('success', 'Votre profil a été mis à jour.')
    return response.redirect().toRoute('profile.edit')
  }

  /**
   * Change le mot de passe (après avoir vérifié l'ancien)
   */
  async updatePassword({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { currentPassword, password } = await request.validateUsing(passwordValidator)

    try {
      await User.verifyCredentials(me.email, currentPassword)
    } catch {
      session.flash('error', 'Le mot de passe actuel est incorrect.')
      return response.redirect().toRoute('profile.edit')
    }

    // Le modèle User chiffre automatiquement le nouveau mot de passe
    me.password = password
    await me.save()

    session.flash('success', 'Votre mot de passe a été modifié.')
    return response.redirect().toRoute('profile.edit')
  }
}