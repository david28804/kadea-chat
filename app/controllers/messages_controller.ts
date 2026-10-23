import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import BlockedUser from '#models/blocked_user'
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
  async store({ auth, params, request, response, session }: HttpContext) {
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

    const conversation = await Conversation.find(id)

    // Conversation privée : on refuse l'envoi si l'un des deux a bloqué l'autre
    if (conversation && !conversation.isGroup) {
      const other = await ConversationMember.query()
        .where('conversationId', id)
        .whereNot('userId', user.id)
        .first()

      if (other) {
        const block = await BlockedUser.query()
          .where((query) => {
            query.where('blockerId', user.id).where('blockedId', other.userId)
          })
          .orWhere((query) => {
            query.where('blockerId', other.userId).where('blockedId', user.id)
          })
          .first()

        if (block) {
          session.flash('error', 'Vous ne pouvez pas envoyer de message dans cette conversation.')
          return response.redirect().toRoute('conversations.show', { id })
        }
      }
    }

    const { content } = await request.validateUsing(messageValidator)

    const message = await Message.create({
      conversationId: id,
      senderId: user.id,
      content,
    })

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
   * Marque la conversation comme lue par l'utilisateur
   * et prévient les autres en temps réel (✓✓ rouge)
   */
  async read({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.noContent()
    }

    const membership = await ConversationMember.query()
      .where('conversationId', id)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.notFound('Conversation introuvable')
    }

    membership.lastReadAt = DateTime.now()
    await membership.save()

    transmit.broadcast(`conversations/${id}`, {
      type: 'read',
      userId: user.id,
    })

    return response.noContent()
  }

  /**
   * Annonce que l'utilisateur est en train d'écrire
   */
  async typing({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.noContent()
    }

    const membership = await ConversationMember.query()
      .where('conversationId', id)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.notFound('Conversation introuvable')
    }

    transmit.broadcast(`conversations/${id}`, {
      type: 'typing',
      userId: user.id,
      name: user.fullName ?? user.email,
    })

    return response.noContent()
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

      transmit.broadcast(`conversations/${message.conversationId}`, {
        type: 'deleted',
        id: message.id,
      })
    }

    return response.redirect().toRoute('conversations.show', { id: message.conversationId })
  }
}