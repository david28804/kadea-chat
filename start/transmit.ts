import transmit from '@adonisjs/transmit/services/main'
import ConversationMember from '#models/conversation_member'

/**
 * Seuls les membres d'une conversation peuvent écouter son canal
 */
transmit.authorize<{ id: string }>('conversations/:id', async (ctx, { id }) => {
  const user = ctx.auth.user
  if (!user) return false

  const membership = await ConversationMember.query()
    .where('conversationId', Number(id))
    .where('userId', user.id)
    .first()

  return membership !== null
})

/**
 * Le canal de présence est réservé aux personnes connectées
 */
transmit.authorize('presence', (ctx) => {
  return ctx.auth.user !== undefined && ctx.auth.user !== null
})