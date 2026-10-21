import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import transmit from '@adonisjs/transmit/services/main'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
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

    const membership = await ConversationMember.query()
      .where('conversationId', id)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.notFound('Conversation introuvable')
    }

    const { content } = await request.validateUsing(messageValidator)

    const message = await Message.create({
      conversationId: id,
      senderId: user.id,
      content,
    })

    const conversation = await Conversation.find(id)
    if (conversation) {
      await conversation.save()
    }

    transmit.broadcast(`conversations/${id}`, {
      type: 'new',
      id: message.id,
      senderId: user.id,
      author: user.fullName ?? user.email,
      content,
      time: DateTime.now().toFormat('HH:mm'),
    })

    return response.redirect().toRoute('conversations.show', { id })
  }

  /**
   * Supprime un message : seul son auteur peut le faire
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.notFound('Message introuvable')
    }

    const message = await Message.find(id)
    if (!message) {
      return response.notFound('Message introuvable')
    }

    if (message.senderId !== user.id) {
      return response.forbidden('Vous ne pouvez supprimer que vos propres messages')
    }

    if (!message.isDeleted) {
      message.deletedAt = DateTime.now()
      message.content = null
      await message.save()

      // Prévient les autres personnes de la conversation
      transmit.broadcast(`conversations/${message.conversationId}`, {
        type: 'deleted',
        id: message.id,
      })
    }

    return response.redirect().toRoute('conversations.show', { id: message.conversationId })
  }
}