import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EmailToken from '#models/email_token'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import env from '#start/env'

// Les administrateurs sont désignés par leur adresse dans ADMIN_EMAILS
const ADMIN_EMAILS = (env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  get isAdmin() {
    return ADMIN_EMAILS.includes(this.email.toLowerCase())
  }

  @hasMany(() => EmailToken)
  declare emailTokens: HasMany<typeof EmailToken>

  @hasMany(() => ConversationMember)
  declare memberships: HasMany<typeof ConversationMember>

  @hasMany(() => Message, { foreignKey: 'senderId' })
  declare messages: HasMany<typeof Message>

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
