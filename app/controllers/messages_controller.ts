import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'

const messageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1).maxLength(2000),
  })
)

export default class MessagesController {
  /**
   * Enregistre un nouveau message dans une conversation
   */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.notFound('Conversation introuvable')
    }

    // Seuls les membres peuvent écrire dans la conversation
    const membership = await ConversationMember.query()
      .where('conversationId', id)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.notFound('Conversation introuvable')
    }

    const { content } = await request.validateUsing(messageValidator)

    await Message.create({
      conversationId: id,
      senderId: user.id,
      content,
    })

    // Garde la conversation à jour (pour le tri futur)
    const conversation = await Conversation.find(id)
    if (conversation) {
      await conversation.save()
    }

    return response.redirect().toRoute('conversations.show', { id })
  }
}