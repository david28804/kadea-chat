import { ConversationMemberSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Conversation from '#models/conversation'

export default class ConversationMember extends ConversationMemberSchema {
  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get isAdmin() {
    return this.role === 'admin'
  }
}