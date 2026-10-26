import User from '#models/user'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import { DateTime } from 'luxon'

export const PASSWORD = 'motdepasse123'

let counter = 0

/**
 * Crée un compte confirmé, prêt à se connecter
 */
export async function createUser(fullName = 'Utilisateur Test') {
  counter++
  return User.create({
    fullName,
    email: `test-${Date.now()}-${counter}@example.test`,
    password: PASSWORD,
    emailVerifiedAt: DateTime.now(),
  })
}

/**
 * Crée un groupe : le premier utilisateur est administrateur, les autres membres
 */
export async function createGroup(name: string, admin: User, members: User[]) {
  const group = await Conversation.create({ type: 'group', name, createdBy: admin.id })
  await ConversationMember.createMany([
    { conversationId: group.id, userId: admin.id, role: 'admin', joinedAt: DateTime.now() },
    ...members.map((member, index) => ({
      conversationId: group.id,
      userId: member.id,
      role: 'member' as const,
      // Écart d'une seconde : l'ordre d'arrivée sert à choisir le prochain administrateur
      joinedAt: DateTime.now().plus({ seconds: index + 1 }),
    })),
  ])
  return group
}

/**
 * Crée une conversation privée entre deux personnes
 */
export async function createPrivate(a: User, b: User) {
  const conversation = await Conversation.create({
    type: 'private',
    directKey: `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`,
    createdBy: a.id,
  })
  await ConversationMember.createMany([
    { conversationId: conversation.id, userId: a.id, role: 'member', joinedAt: DateTime.now() },
    { conversationId: conversation.id, userId: b.id, role: 'member', joinedAt: DateTime.now() },
  ])
  return conversation
}

export async function postMessage(conversation: Conversation, sender: User, content: string) {
  return Message.create({ conversationId: conversation.id, senderId: sender.id, content })
}
