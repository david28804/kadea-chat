import User from '#models/user'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Transforme "David Mbiya" en "DM"
 */
function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

/**
 * "Aujourd'hui", "Hier" ou "15/10/2026"
 */
function dayLabel(date: DateTime) {
  const now = DateTime.now()
  if (date.hasSame(now, 'day')) return "Aujourd'hui"
  if (date.hasSame(now.minus({ days: 1 }), 'day')) return 'Hier'
  return date.toFormat('dd/MM/yyyy')
}

export default class ConversationsController {
  /**
   * Construit la liste des conversations d'un utilisateur (colonne de gauche)
   */
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
          .orderBy('createdAt', 'desc')
          .first()

        const other = conversation.members.find((member) => member.userId !== user.id)
        const title = conversation.isGroup
          ? (conversation.name ?? 'Groupe')
          : (other?.user.fullName ?? other?.user.email ?? 'Conversation')

        let preview = 'Aucun message pour le moment'
        if (lastMessage) {
          const prefix = lastMessage.senderId === user.id ? 'Vous : ' : ''
          preview = prefix + (lastMessage.content ?? '')
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
          sortKey: activity.toMillis(),
        }
      })
    )

    items.sort((a, b) => b.sortKey - a.sortKey)
    return items
  }

  /**
   * Liste des conversations, sans conversation ouverte
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversations = await this.buildList(user)

    return view.render('pages/dashboard', { conversations, active: null, messages: [] })
  }

  /**
   * Ouvre une conversation : liste à gauche, messages à droite
   */
  async show({ auth, params, view, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)

    if (!Number.isInteger(id)) {
      return response.notFound('Conversation introuvable')
    }

    // L'utilisateur doit être membre de cette conversation
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

    const conversation = membership.conversation
    const other = conversation.members.find((member) => member.userId !== user.id)
    const title = conversation.isGroup
      ? (conversation.name ?? 'Groupe')
      : (other?.user.fullName ?? other?.user.email ?? 'Conversation')

    const active = {
      id: conversation.id,
      title,
      initials: initialsOf(title),
      isGroup: conversation.isGroup,
      subtitle: conversation.isGroup ? `${conversation.members.length} membres` : (other?.user.email ?? ''),
    }

    // Les 200 derniers messages, du plus ancien au plus récent
    const rows = await Message.query()
      .where('conversationId', id)
      .preload('sender')
      .orderBy('createdAt', 'desc')
      .limit(200)
    rows.reverse()

    let previousDay = ''
    const messages = rows.map((message) => {
      const day = dayLabel(message.createdAt)
      const showDay = day !== previousDay
      previousDay = day

      return {
        id: message.id,
        content: message.isDeleted ? null : message.content,
        isDeleted: message.isDeleted,
        isMine: message.senderId === user.id,
        author: message.sender?.fullName ?? message.sender?.email ?? 'Utilisateur supprimé',
        time: message.createdAt.toFormat('HH:mm'),
        day,
        showDay,
      }
    })

    // Marque la conversation comme lue
    membership.lastReadAt = DateTime.now()
    await membership.save()

    const conversations = await this.buildList(user)

    return view.render('pages/dashboard', { conversations, active, messages })
  }

  /**
   * Page "Nouvelle conversation" : liste des utilisateurs, avec recherche
   */
  async create({ auth, request, view }: HttpContext) {
    const me = auth.getUserOrFail()
    const q = String(request.input('q', '')).trim()

    const users = await User.query()
      .whereNot('id', me.id)
      .whereNotNull('emailVerifiedAt')
      .if(q, (query) => {
        query.where((group) => {
          group.whereILike('fullName', `%${q}%`).orWhereILike('email', `%${q}%`)
        })
      })
      .orderBy('fullName', 'asc')
      .limit(50)

    const people = users.map((person) => {
      const name = person.fullName ?? person.email
      return { id: person.id, name, email: person.email, initials: initialsOf(name) }
    })

    return view.render('pages/conversations/new', { people, q })
  }

  /**
   * Crée la conversation privée avec l'utilisateur choisi (ou réutilise l'existante)
   */
  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const otherId = Number(request.input('userId'))

    if (!Number.isInteger(otherId) || otherId === me.id) {
      session.flash('error', 'Utilisateur invalide.')
      return response.redirect().toRoute('conversations.create')
    }

    const other = await User.find(otherId)
    if (!other) {
      session.flash('error', 'Utilisateur introuvable.')
      return response.redirect().toRoute('conversations.create')
    }

    // Clé unique pour deux personnes, quel que soit l'ordre : "3-7"
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

    // On ouvre directement la conversation
    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}