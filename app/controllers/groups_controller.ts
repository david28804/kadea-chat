import User from '#models/user'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'

const groupValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(60),
  })
)

export default class GroupsController {
  /**
   * Crée le groupe et ses membres
   */
  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { name } = await request.validateUsing(groupValidator)

    // Une seule case cochée arrive comme texte, plusieurs comme tableau
    const raw = request.input('members', [])
    const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).map(Number))].filter(
      (id) => Number.isInteger(id) && id !== me.id
    )

    // Seuls les comptes existants et confirmés peuvent être ajoutés
    const members = await User.query().whereIn('id', ids).whereNotNull('emailVerifiedAt')

    if (members.length === 0) {
      session.flash('error', 'Choisissez au moins un membre pour le groupe.')
      session.flash('newchat', 'group')
      return response.redirect().toRoute('dashboard')
    }

    const group = await Conversation.create({
      type: 'group',
      name,
      createdBy: me.id,
    })

    await ConversationMember.createMany([
      { conversationId: group.id, userId: me.id, role: 'admin', joinedAt: DateTime.now() },
      ...members.map((member) => ({
        conversationId: group.id,
        userId: member.id,
        role: 'member' as const,
        joinedAt: DateTime.now(),
      })),
    ])

    return response.redirect().toRoute('conversations.show', { id: group.id })
  }
}