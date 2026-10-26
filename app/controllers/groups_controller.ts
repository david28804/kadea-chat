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

/**
 * Identifiants des cases « members » cochées, sans doublon ni soi-même.
 * Une seule case cochée arrive comme texte, plusieurs comme tableau.
 */
function memberIdsFrom(raw: unknown, meId: number) {
  return [...new Set((Array.isArray(raw) ? raw : [raw]).map(Number))].filter(
    (id) => Number.isInteger(id) && id !== meId
  )
}

export default class GroupsController {
  /**
   * Mon appartenance au groupe :id (null si ce n'est pas un groupe dont je suis membre)
   */
  private async myMembership(groupId: number, userId: number) {
    if (!Number.isInteger(groupId)) return null

    const membership = await ConversationMember.query()
      .where('conversationId', groupId)
      .where('userId', userId)
      .preload('conversation')
      .first()

    return membership?.conversation.isGroup ? membership : null
  }

  /**
   * Crée le groupe et ses membres
   */
  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const { name } = await request.validateUsing(groupValidator)
    const ids = memberIdsFrom(request.input('members', []), me.id)

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

  /**
   * Ajoute des membres (réservé aux administrateurs du groupe)
   */
  async addMembers({ auth, params, request, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const groupId = Number(params.id)
    const membership = await this.myMembership(groupId, me.id)

    if (!membership) {
      return response.notFound('Groupe introuvable')
    }
    if (!membership.isAdmin) {
      session.flash('error', 'Seul un administrateur peut ajouter des membres.')
      return response.redirect().toRoute('conversations.show', { id: groupId })
    }

    const ids = memberIdsFrom(request.input('members', []), me.id)

    // On ignore les personnes déjà membres et les comptes non confirmés
    const current = await ConversationMember.query().where('conversationId', groupId)
    const currentIds = new Set(current.map((member) => member.userId))
    const users = await User.query()
      .whereIn('id', ids)
      .whereNotNull('emailVerifiedAt')
    const newcomers = users.filter((user) => !currentIds.has(user.id))

    if (newcomers.length === 0) {
      session.flash('error', 'Choisissez au moins une personne à ajouter.')
      return response.redirect().toRoute('conversations.show', { id: groupId })
    }

    await ConversationMember.createMany(
      newcomers.map((user) => ({
        conversationId: groupId,
        userId: user.id,
        role: 'member' as const,
        joinedAt: DateTime.now(),
      }))
    )

    session.flash(
      'success',
      newcomers.length === 1
        ? `${newcomers[0].fullName ?? newcomers[0].email} a été ajouté(e) au groupe.`
        : `${newcomers.length} personnes ont été ajoutées au groupe.`
    )
    return response.redirect().toRoute('conversations.show', { id: groupId })
  }

  /**
   * Retire un membre (réservé aux administrateurs, pas soi-même : il faut quitter)
   */
  async removeMember({ auth, params, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const groupId = Number(params.id)
    const membership = await this.myMembership(groupId, me.id)

    if (!membership) {
      return response.notFound('Groupe introuvable')
    }
    if (!membership.isAdmin) {
      session.flash('error', 'Seul un administrateur peut retirer des membres.')
      return response.redirect().toRoute('conversations.show', { id: groupId })
    }

    const target = await ConversationMember.query()
      .where('conversationId', groupId)
      .where('userId', Number(params.userId))
      .whereNot('userId', me.id)
      .preload('user')
      .first()

    if (!target) {
      session.flash('error', 'Ce membre ne fait pas partie du groupe.')
      return response.redirect().toRoute('conversations.show', { id: groupId })
    }

    await target.delete()

    session.flash('success', `${target.user.fullName ?? target.user.email} a été retiré(e) du groupe.`)
    return response.redirect().toRoute('conversations.show', { id: groupId })
  }

  /**
   * Quitte le groupe. Le dernier membre qui part supprime le groupe ;
   * si plus aucun administrateur ne reste, le membre le plus ancien le devient.
   */
  async leave({ auth, params, response, session }: HttpContext) {
    const me = auth.getUserOrFail()
    const groupId = Number(params.id)
    const membership = await this.myMembership(groupId, me.id)

    if (!membership) {
      return response.notFound('Groupe introuvable')
    }

    const group = membership.conversation
    await membership.delete()

    const remaining = await ConversationMember.query()
      .where('conversationId', groupId)
      .orderBy('joinedAt', 'asc')

    if (remaining.length === 0) {
      await group.delete()
    } else if (!remaining.some((member) => member.isAdmin)) {
      remaining[0].role = 'admin'
      await remaining[0].save()
    }

    session.flash('success', `Vous avez quitté le groupe « ${group.name ?? 'Groupe'} ».`)
    return response.redirect().toRoute('dashboard')
  }
}
