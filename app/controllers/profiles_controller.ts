import User from '#models/user'
import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import string from '@adonisjs/core/helpers/string'
import fs from 'node:fs/promises'
import path from 'node:path'
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

const avatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    }),
  })
)

const AVATAR_DIR = 'public/uploads/avatars'

/**
 * Efface l'ancienne photo du disque (seulement dans notre dossier d'avatars)
 */
async function removeAvatarFile(avatar: string | null) {
  if (!avatar) return
  const fileName = path.basename(avatar)
  await fs.rm(app.makePath(AVATAR_DIR, fileName), { force: true })
}

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

  /**
   * Enregistre la photo de profil
   */
  async updateAvatar({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { avatar } = await request.validateUsing(avatarValidator)

    // Nom aléatoire : on n'utilise jamais le nom envoyé par l'ordinateur
    const fileName = `${string.uuid()}.${avatar.extname}`

    await fs.mkdir(app.makePath(AVATAR_DIR), { recursive: true })
    await avatar.move(app.makePath(AVATAR_DIR), { name: fileName })

    // On supprime l'ancienne photo, puis on retient la nouvelle
    await removeAvatarFile(me.avatar)
    me.avatar = `uploads/avatars/${fileName}`
    await me.save()

    session.flash('success', 'Votre photo de profil a été mise à jour.')
    return response.redirect().toRoute('profile.edit')
  }

  /**
   * Supprime la photo de profil
   */
  async destroyAvatar({ auth, response, session }: HttpContext) {
    const me = auth.getUserOrFail()

    await removeAvatarFile(me.avatar)
    me.avatar = null
    await me.save()

    session.flash('success', 'Votre photo de profil a été supprimée.')
    return response.redirect().toRoute('profile.edit')
  }
}