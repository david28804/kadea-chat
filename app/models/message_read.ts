import { MessageReadSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'
import User from '#models/user'

export default class MessageRead extends MessageReadSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}