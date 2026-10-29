import User from '#models/user'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs/promises'
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

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
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
   * Enregistre la photo de profil dans la base de données
   * (le disque de l'hébergeur est effacé à chaque redémarrage)
   */
  async updateAvatar({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { avatar } = await request.validateUsing(avatarValidator)

    const data = await fs.readFile(avatar.tmpPath!)
    const now = new Date()

    await db
      .table('user_avatars')
      .insert({
        user_id: me.id,
        data,
        mime_type: MIME_TYPES[avatar.extname!.toLowerCase()],
        updated_at: now,
      })
      .onConflict('user_id')
      .merge()

    // Le numéro de version force le navigateur à recharger la nouvelle photo
    me.avatar = `avatars/${me.id}?v=${now.getTime()}`
    await me.save()

    session.flash('success', 'Votre photo de profil a été mise à jour.')
    return response.redirect().toRoute('profile.edit')
  }

  /**
   * Supprime la photo de profil
   */
  async destroyAvatar({ auth, response, session }: HttpContext) {
    const me = auth.getUserOrFail()

    await db.from('user_avatars').where('user_id', me.id).delete()
    me.avatar = null
    await me.save()

    session.flash('success', 'Votre photo de profil a été supprimée.')
    return response.redirect().toRoute('profile.edit')
  }

  /**
   * Envoie la photo de profil d'un utilisateur
   */
  async showAvatar({ params, response }: HttpContext) {
    const avatar = await db.from('user_avatars').where('user_id', params.id).first()

    if (!avatar) {
      return response.notFound('Photo introuvable')
    }

    // L'adresse change à chaque nouvelle photo : le navigateur peut la garder longtemps
    response.header('Content-Type', avatar.mime_type)
    response.header('Cache-Control', 'private, max-age=31536000, immutable')
    response.header('X-Content-Type-Options', 'nosniff')
    return response.send(avatar.data)
  }
}
