import { MessageSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Conversation from '#models/conversation'
import User from '#models/user'
import MessageAttachment from '#models/message_attachment'
import MessageRead from '#models/message_read'

export default class Message extends MessageSchema {
  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User, { foreignKey: 'senderId' })
  declare sender: BelongsTo<typeof User>

  @hasMany(() => MessageAttachment)
  declare attachments: HasMany<typeof MessageAttachment>

  @hasMany(() => MessageRead)
  declare reads: HasMany<typeof MessageRead>

  get isDeleted() {
    return this.deletedAt !== null
  }
}