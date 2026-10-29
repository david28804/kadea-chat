import User from '#models/user'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import BlockedUser from '#models/blocked_user'
import PresenceService from '#services/presence_service'
import transmit from '@adonisjs/transmit/services/main'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

function dayLabel(date: DateTime) {
  const now = DateTime.now()
  if (date.hasSame(now, 'day')) return "Aujourd'hui"
  if (date.hasSame(now.minus({ days: 1 }), 'day')) return 'Hier'
  return date.toFormat('dd/MM/yyyy')
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// Extrait du message autour du mot trouvé : « …avant MOT après… »
function snippetAround(content: string, query: string, radius = 40) {
  const at = content.toLowerCase().indexOf(query.toLowerCase())
  if (at === -1) return content.slice(0, radius * 2)
  const start = Math.max(0, at - radius)
  const end = Math.min(content.length, at + query.length + radius)
  return `${start > 0 ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`
}

export default class ConversationsController {
  /**
   * Recherche d'un mot dans les messages de toutes mes conversations (JSON,
   * utilisé par la barre de recherche de la liste)
   */
  async searchMessages({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const query = String(request.input('q', '')).trim().slice(0, 100)
    if (query.length < 2) return []

    const memberships = await ConversationMember.query().where('userId', user.id)
    const conversationIds = memberships.map((membership) => membership.conversationId)
    if (conversationIds.length === 0) return []

    // On échappe % et _ pour qu'ils soient cherchés comme de simples caractères
    const safe = query.replace(/[\\%_]/g, '\\$&')
    const rows = await Message.query()
      .whereIn('conversationId', conversationIds)
      .whereNull('deletedAt')
      .whereILike('content', `%${safe}%`)
      .preload('sender')
      .preload('conversation', (conversation) => {
        conversation.preload('members', (member) => member.preload('user'))
      })
      .orderBy('createdAt', 'desc')
      .limit(30)

    return rows.map((message) => {
      const conversation = message.conversation
      const other = conversation.members.find((member) => member.userId !== user.id)
      const title = conversation.isGroup
        ? (conversation.name ?? 'Groupe')
        : (other?.user.fullName ?? other?.user.email ?? 'Conversation')
      const author =
        message.senderId === user.id
          ? 'Vous'
          : (message.sender?.fullName ?? message.sender?.email ?? 'Utilisateur supprimé')

      return {
        id: message.id,
        title,
        author: conversation.isGroup || message.senderId === user.id ? author : null,
        snippet: snippetAround(message.content ?? '', query),
        time: message.createdAt.hasSame(DateTime.now(), 'day')
          ? message.createdAt.toFormat('HH:mm')
          : message.createdAt.toFormat('dd/MM'),
        url: `/conversations/${conversation.id}?q=${encodeURIComponent(query)}`,
      }
    })
  }

  private async buildList(user: User) {
    const memberships = await ConversationMember.query()
      .where('userId', user.id)
      .preload('conversation', (conversation) => {
        conversation.preload('members', (member) => member.preload('user'))
      })

    const items = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = membership.conversation

        const lastMessage = await Message.query()
          .where('conversationId', conversation.id)
          .whereNull('deletedAt')
          .preload('attachments')
          .orderBy('createdAt', 'desc')
          .first()

        const unreadQuery = Message.query()
          .where('conversationId', conversation.id)
          .whereNull('deletedAt')
          .where('senderId', '<>', user.id)
        if (membership.lastReadAt) {
          unreadQuery.where('createdAt', '>', membership.lastReadAt.toSQL()!)
        }
        const unreadResult = await unreadQuery.count('* as total')
        const unread = Number(unreadResult[0].$extras.total)

        const other = conversation.members.find((member) => member.userId !== user.id)
        const title = conversation.isGroup
          ? (conversation.name ?? 'Groupe')
          : (other?.user.fullName ?? other?.user.email ?? 'Conversation')

        let preview = 'Aucun message pour le moment'
        if (lastMessage) {
          const prefix = lastMessage.senderId === user.id ? 'Vous : ' : ''
          const body =
            lastMessage.content ?? (lastMessage.attachments.length > 0 ? '📎 Fichier joint' : '')
          preview = prefix + body
        }

        const activity = lastMessage ? lastMessage.createdAt : conversation.createdAt
        const time = activity.hasSame(DateTime.now(), 'day')
          ? activity.toFormat('HH:mm')
          : activity.toFormat('dd/MM')

        return {
          id: conversation.id,
          title,
          initials: initialsOf(title),
          isGroup: conversation.isGroup,
          preview,
          time,
          unread,
          otherId: conversation.isGroup ? null : (other?.userId ?? null),
          avatar: conversation.isGroup ? null : (other?.user.avatar ?? null),
          online: !conversation.isGroup && other ? PresenceService.isOnline(other.userId) : false,
          sortKey: activity.toMillis(),
        }
      })
    )

    items.sort((a, b) => b.sortKey - a.sortKey)
    return items
  }

  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await this.buildList(user)

    const people = await this.buildPeople(user)

    return view.render('pages/dashboard', {
      conversations,
      people,
      active: null,
      messages: [],
      search: '',
    })
  }

  async show({ auth, params, request, view, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.notFound('Conversation introuvable')
    }

    const membership = await ConversationMember.query()
      .where('conversationId', id)
      .where('userId', user.id)
      .preload('conversation', (conversation) => {
        conversation.preload('members', (member) => member.preload('user'))
      })
      .first()

    if (!membership) {
      return response.notFound('Conversation introuvable')
    }

    // Mot recherché dans la conversation (vide = pas de recherche)
    const search = String(request.input('q', '')).trim().slice(0, 100)

    const conversation = membership.conversation
    const other = conversation.members.find((member) => member.userId !== user.id)
    const title = conversation.isGroup
      ? (conversation.name ?? 'Groupe')
      : (other?.user.fullName ?? other?.user.email ?? 'Conversation')

    // Blocage : qui a bloqué qui (conversations privées seulement)
    let blockedByMe = false
    let blockedMe = false
    if (!conversation.isGroup && other) {
      const blocks = await BlockedUser.query()
        .where((query) => {
          query.where('blockerId', user.id).where('blockedId', other.userId)
        })
        .orWhere((query) => {
          query.where('blockerId', other.userId).where('blockedId', user.id)
        })
      blockedByMe = blocks.some((block) => block.blockerId === user.id)
      blockedMe = blocks.some((block) => block.blockerId === other.userId)
    }

    const active = {
      id: conversation.id,
      title,
      initials: initialsOf(title),
      isGroup: conversation.isGroup,
      subtitle: conversation.isGroup ? `${conversation.members.length} membres` : '',
      otherId: conversation.isGroup ? null : (other?.userId ?? null),
      avatar: conversation.isGroup ? null : (other?.user.avatar ?? null),
      blockedByMe,
      blockedMe,
      online: !conversation.isGroup && other ? PresenceService.isOnline(other.userId) : false,
      iAmAdmin: conversation.isGroup && membership.isAdmin,
      // Membres du groupe : administrateurs d'abord, puis par nom
      members: conversation.isGroup
        ? conversation.members
            .map((member) => {
              const name = member.user.fullName ?? member.user.email
              return {
                userId: member.userId,
                name,
                initials: initialsOf(name),
                avatar: member.user.avatar ?? null,
                isAdmin: member.isAdmin,
                isMe: member.userId === user.id,
              }
            })
            .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name))
        : [],
    }

    const rows = await Message.query()
      .where('conversationId', id)
      .if(search, (query) => {
        // On échappe % et _ pour qu'ils soient cherchés comme de simples caractères
        const safe = search.replace(/[\\%_]/g, '\\$&')
        query.whereNull('deletedAt').whereILike('content', `%${safe}%`)
      })
      .preload('sender')
      .preload('attachments')
      .orderBy('createdAt', 'desc')
      .limit(200)
    rows.reverse()

    // Les autres membres : servent à calculer le statut (envoyé / reçu / lu)
    const others = conversation.members.filter((member) => member.userId !== user.id)

    let previousDay = ''
    const messages = rows.map((message) => {
      const day = dayLabel(message.createdAt)
      const showDay = day !== previousDay
      previousDay = day

      let status = 'sent'
      if (message.senderId === user.id && others.length > 0) {
        const allRead = others.every(
          (member) => member.lastReadAt && member.lastReadAt.toMillis() >= message.createdAt.toMillis()
        )
        const allOnline = others.every((member) => PresenceService.isOnline(member.userId))
        if (allRead) status = 'read'
        else if (allOnline) status = 'delivered'
      }

      // Fichier joint (un seul par message)
      const file = message.isDeleted ? null : (message.attachments[0] ?? null)
      const attachment = file
        ? {
            id: file.id,
            name: file.originalName,
            size: sizeLabel(file.size),
            isImage: file.mimeType.startsWith('image/'),
            url: `/attachments/${file.id}`,
          }
        : null

      return {
        status,
        attachment,
        id: message.id,
        content: message.isDeleted ? null : message.content,
        isDeleted: message.isDeleted,
        isEdited: !message.isDeleted && message.editedAt !== null,
        isMine: message.senderId === user.id,
        author: message.sender?.fullName ?? message.sender?.email ?? 'Utilisateur supprimé',
        time: message.createdAt.toFormat('HH:mm'),
        day,
        showDay,
      }
    })

    // Pendant une recherche, on ne marque pas la conversation comme lue
    if (!search) {
      membership.lastReadAt = DateTime.now()
      await membership.save()

      // Prévient les autres : mes messages passent en « lu » chez eux
      transmit.broadcast(`conversations/${id}`, { type: 'read', userId: user.id })
    }

    const conversations = await this.buildList(user)

    const people = await this.buildPeople(user)

    // Personnes qu'un administrateur peut encore ajouter au groupe
    const memberIds = new Set(active.members.map((member) => member.userId))
    const addable = active.iAmAdmin ? people.filter((person) => !memberIds.has(person.id)) : []

    return view.render('pages/dashboard', {
      conversations,
      people,
      addable,
      active,
      messages,
      search,
    })
  }

  /**
   * Personnes proposées dans la fenêtre « Nouveau » (conversation ou groupe)
   */
  private async buildPeople(user: User) {
    const users = await User.query()
      .whereNot('id', user.id)
      .whereNotNull('emailVerifiedAt')
      .orderBy('fullName', 'asc')
      .limit(100)

    return users.map((person) => {
      const name = person.fullName ?? person.email
      return {
        id: person.id,
        name,
        initials: initialsOf(name),
        avatar: person.avatar ?? null,
      }
    })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const otherId = Number(request.input('userId'))

    if (!Number.isInteger(otherId) || otherId === me.id) {
      session.flash('error', 'Utilisateur invalide.')
      return response.redirect().toRoute('dashboard')
    }

    const other = await User.find(otherId)
    if (!other) {
      session.flash('error', 'Utilisateur introuvable.')
      return response.redirect().toRoute('dashboard')
    }

    const directKey = `${Math.min(me.id, other.id)}-${Math.max(me.id, other.id)}`

    let conversation = await Conversation.findBy('directKey', directKey)

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'private',
        directKey,
        createdBy: me.id,
      })

      await ConversationMember.createMany([
        { conversationId: conversation.id, userId: me.id, role: 'member', joinedAt: DateTime.now() },
        { conversationId: conversation.id, userId: other.id, role: 'member', joinedAt: DateTime.now() },
      ])
    }

    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}