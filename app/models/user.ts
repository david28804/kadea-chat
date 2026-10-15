import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EmailToken from '#models/email_token'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
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