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

export default class ConversationsController {
  /**
   * Liste des conversations de l'utilisateur connecté
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

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

    return view.render('pages/dashboard', { conversations: items })
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

      session.flash('success', 'Conversation créée.')
    }

    return response.redirect().toRoute('dashboard')
  }
}