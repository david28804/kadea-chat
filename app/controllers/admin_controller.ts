import User from '#models/user'
import PresenceService from '#services/presence_service'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

const PER_PAGE = 20

/**
 * Compte les lignes d'une requête (PostgreSQL renvoie le total en texte)
 */
async function count(query: ReturnType<typeof db.from>) {
  const [row] = await query.count('* as total')
  return Number(row.total)
}

export default class AdminController {
  /**
   * Tableau de bord : chiffres clés et liste des utilisateurs
   */
  async index({ auth, request, view }: HttpContext) {
    const search = String(request.input('q', '')).trim()
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    const [users, confirmed, privates, groups, messages, files] = await Promise.all([
      count(db.from('users')),
      count(db.from('users').whereNotNull('email_verified_at')),
      count(db.from('conversations').where('type', 'private')),
      count(db.from('conversations').where('type', 'group')),
      count(db.from('messages').whereNull('deleted_at')),
      count(db.from('message_attachments')),
    ])

    const people = await User.query()
      .if(search, (query) => {
        query.where((sub) => {
          sub.whereILike('full_name', `%${search}%`).orWhereILike('email', `%${search}%`)
        })
      })
      .withCount('memberships')
      .withCount('messages', (query) => query.whereNull('deletedAt'))
      .orderBy('createdAt', 'desc')
      .paginate(page, PER_PAGE)

    people.baseUrl('/admin').queryString(search ? { q: search } : {})

    return view.render('pages/admin/index', {
      search,
      stats: {
        users,
        confirmed,
        pending: users - confirmed,
        online: PresenceService.onlineCount(),
        privates,
        groups,
        messages,
        files,
      },
      people: people.all().map((person) => ({
        id: person.id,
        name: person.fullName ?? person.email,
        email: person.email,
        initials: person.initials,
        avatar: person.avatar,
        confirmed: person.emailVerifiedAt !== null,
        online: PresenceService.isOnline(person.id),
        isAdmin: person.isAdmin,
        canDelete: person.id !== auth.user?.id,
        joinedAt: person.createdAt.setLocale('fr').toFormat('d LLL yyyy'),
        conversations: Number(person.$extras.memberships_count),
        messages: Number(person.$extras.messages_count),
      })),
      pagination: {
        total: people.total,
        currentPage: people.currentPage,
        lastPage: people.lastPage,
        previousUrl: people.getPreviousPageUrl(),
        nextUrl: people.getNextPageUrl(),
      },
    })
  }

  /**
   * Supprime un compte, sans supprimer les conversations qui ont encore des membres
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const admin = auth.getUserOrFail()
    const userId = Number(params.id)

    if (!Number.isInteger(userId)) {
      session.flash('error', 'Utilisateur invalide.')
      return response.redirect().toRoute('admin.index')
    }

    if (userId === admin.id) {
      session.flash('error', 'Vous ne pouvez pas supprimer votre propre compte.')
      return response.redirect().toRoute('admin.index')
    }

    const user = await User.find(userId)
    if (!user) {
      session.flash('error', 'Utilisateur introuvable.')
      return response.redirect().toRoute('admin.index')
    }

    if (user.isAdmin) {
      session.flash('error', 'Un compte administrateur ne peut pas être supprimé depuis cette page.')
      return response.redirect().toRoute('admin.index')
    }

    await db.transaction(async (trx) => {
      const conversations = await trx
        .from('conversation_members')
        .where('user_id', user.id)
        .select('conversation_id')

      await trx.from('users').where('id', user.id).delete()

      if (conversations.length) {
        await trx
          .from('conversations')
          .whereIn(
            'id',
            conversations.map((conversation) => conversation.conversation_id)
          )
          .whereNotExists((query) =>
            query
              .from('conversation_members')
              .select('id')
              .whereColumn('conversation_members.conversation_id', 'conversations.id')
          )
          .delete()
      }
    })

    PresenceService.remove(user.id)
    session.flash('success', `${user.fullName ?? user.email} a été supprimé(e).`)
    return response.redirect().toRoute('admin.index')
  }
}
