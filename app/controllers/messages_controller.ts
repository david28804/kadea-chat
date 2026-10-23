import app from '@adonisjs/core/services/app'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import BlockedUser from '#models/blocked_user'
import transmit from '@adonisjs/transmit/services/main'
import vine, { errors } from '@vinejs/vine'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const FILE_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  'pdf',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
]

const messageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().maxLength(2000).optional().nullable(),
    attachment: vine.file({ size: '5mb', extnames: FILE_EXTENSIONS }).optional(),
  })
)

export default class MessagesController {
  /**
   * Enregistre un nouveau message (texte et/ou fichier) dans une conversation
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

    let payload
    try {
      payload = await request.validateUsing(messageValidator)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        console.error('[fichier refusé]', JSON.stringify(error.messages))
        session.flash(
          'error',
          'Message refusé : fichier de 5 Mo maximum (images, PDF, Word, Excel, PowerPoint, texte ou zip).'
        )
        return response.redirect().toRoute('conversations.show', { id })
      }
      throw error
    }

    const content = payload.content ?? ''
    const file = payload.attachment

    if (!content && !file) {
      session.flash('error', 'Écrivez un message ou joignez un fichier.')
      return response.redirect().toRoute('conversations.show', { id })
    }

    const message = await Message.create({
      conversationId: id,
      senderId: user.id,
      content: content || null,
    })

    // Fichier joint : rangé dans un dossier privé, sous un nom aléatoire
    let attachmentData = null
    if (file) {
      const storedName = `${randomUUID()}.${file.extname}`
      await file.move(app.makePath('storage/uploads/messages'), { name: storedName })

      const attachment = await MessageAttachment.create({
        messageId: message.id,
        originalName: file.clientName,
        storedName,
        mimeType: `${file.type}/${file.subtype}`,
        size: file.size,
      })

      attachmentData = {
        id: attachment.id,
        name: attachment.originalName,
        size: attachment.size,
        isImage: IMAGE_EXTENSIONS.includes((file.extname ?? '').toLowerCase()),
        url: `/attachments/${attachment.id}`,
      }
    }

    if (conversation) {
      await conversation.save()
    }

    transmit.broadcast(`conversations/${id}`, {
      type: 'new',
      id: message.id,
      senderId: user.id,
      author: user.fullName ?? user.email,
      content: content || null,
      attachment: attachmentData,
      time: DateTime.now().toFormat('HH:mm'),
    })

    return response.redirect().toRoute('conversations.show', { id })
  }

  /**
   * Télécharge un fichier joint : réservé aux membres de la conversation
   */
  async attachment({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.notFound('Fichier introuvable')
    }

    const attachment = await MessageAttachment.find(id)
    if (!attachment) {
      return response.notFound('Fichier introuvable')
    }

    const message = await Message.find(attachment.messageId)
    if (!message || message.isDeleted) {
      return response.notFound('Fichier introuvable')
    }

    const membership = await ConversationMember.query()
      .where('conversationId', message.conversationId)
      .where('userId', user.id)
      .first()

    if (!membership) {
      return response.notFound('Fichier introuvable')
    }

    const path = app.makePath('storage/uploads/messages', attachment.storedName)
    const extension = attachment.storedName.split('.').pop()?.toLowerCase() ?? ''

    response.header('X-Content-Type-Options', 'nosniff')

    // Les images s'affichent dans la page, le reste se télécharge
    if (IMAGE_EXTENSIONS.includes(extension)) {
      return response.download(path)
    }
    return response.attachment(path, attachment.originalName)
  }

  /**
   * Marque la conversation comme lue par l'utilisateur
   * et prévient les autres en temps réel (✓✓ bleu)
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