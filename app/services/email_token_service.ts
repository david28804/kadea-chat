import { randomBytes, createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import User from '#models/user'
import EmailToken from '#models/email_token'

export default class EmailTokenService {
  static hash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Crée un jeton, stocke son empreinte en base et renvoie le jeton en clair
   * (c'est lui qui part dans l'e-mail).
   */
  static async create(user: User, type: 'confirmation' | 'reset', minutes: number) {
    await EmailToken.query()
      .where('userId', user.id)
      .where('type', type)
      .whereNull('usedAt')
      .delete()

    const token = randomBytes(32).toString('hex')
    await EmailToken.create({
      userId: user.id,
      type,
      tokenHash: this.hash(token),
      expiresAt: DateTime.now().plus({ minutes }),
    })
    return token
  }

  static async sendConfirmation(user: User) {
    const token = await this.create(user, 'confirmation', 60 * 24)
    const url = `${env.get('APP_URL')}/email/confirm/${token}`

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Confirmez votre adresse e-mail - Kadea Chat')
        .html(`
          <h2>Bienvenue sur Kadea Chat, ${user.fullName ?? ''} !</h2>
          <p>Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail.</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">Confirmer mon e-mail</a></p>
          <p>Ce lien est valable 24 heures.</p>
        `)
    })
  }

  static async sendReset(user: User) {
    const token = await this.create(user, 'reset', 60)
    const url = `${env.get('APP_URL')}/reset-password/${token}`

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Réinitialisation de votre mot de passe - Kadea Chat')
        .html(`
          <h2>Bonjour ${user.fullName ?? ''},</h2>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
          <p>Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.</p>
        `)
    })
  }
}