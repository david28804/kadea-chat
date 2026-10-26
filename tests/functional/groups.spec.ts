import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import { createGroup, createUser } from '#tests/helpers'

async function memberIds(groupId: number) {
  const members = await ConversationMember.query().where('conversationId', groupId)
  return members.map((member) => member.userId)
}

test.group('Groupes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('créer un groupe : le créateur en devient administrateur', async ({ client, assert }) => {
    const [admin, b] = [await createUser(), await createUser()]

    await client
      .post('/groups')
      .form({ name: 'Projet final', members: [b.id] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    const created = await Conversation.findByOrFail('name', 'Projet final')
    const membership = await ConversationMember.query()
      .where('conversationId', created.id)
      .where('userId', admin.id)
      .firstOrFail()
    assert.equal(membership.role, 'admin')
  })

  test('un administrateur ajoute un membre', async ({ client, assert }) => {
    const [admin, b, newcomer] = [await createUser(), await createUser(), await createUser()]
    const group = await createGroup('Promo', admin, [b])

    const response = await client
      .post(`/groups/${group.id}/members`)
      .form({ members: [newcomer.id] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertFlashMessage('success')
    assert.include(await memberIds(group.id), newcomer.id)
  })

  test('un simple membre ne peut pas ajouter de membre', async ({ client, assert }) => {
    const [admin, member, newcomer] = [await createUser(), await createUser(), await createUser()]
    const group = await createGroup('Promo', admin, [member])

    const response = await client
      .post(`/groups/${group.id}/members`)
      .form({ members: [newcomer.id] })
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)

    response.assertFlashMessage('error')
    assert.notInclude(await memberIds(group.id), newcomer.id)
  })

  test("un administrateur retire un membre, qui perd l'accès au groupe", async ({
    client,
    assert,
  }) => {
    const [admin, member] = [await createUser(), await createUser()]
    const group = await createGroup('Promo', admin, [member])

    await client
      .post(`/groups/${group.id}/members/${member.id}/remove`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    assert.notInclude(await memberIds(group.id), member.id)
    const response = await client.get(`/conversations/${group.id}`).loginAs(member)
    response.assertStatus(404)
  })

  test('un simple membre ne peut retirer personne', async ({ client, assert }) => {
    const [admin, member, other] = [await createUser(), await createUser(), await createUser()]
    const group = await createGroup('Promo', admin, [member, other])

    await client
      .post(`/groups/${group.id}/members/${other.id}/remove`)
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)

    assert.include(await memberIds(group.id), other.id)
  })

  test("si l'administrateur part, le membre le plus ancien le remplace", async ({
    client,
    assert,
  }) => {
    const [admin, first, second] = [await createUser(), await createUser(), await createUser()]
    const group = await createGroup('Promo', admin, [first, second])

    const response = await client
      .post(`/groups/${group.id}/leave`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/dashboard')
    const promoted = await ConversationMember.query()
      .where('conversationId', group.id)
      .where('userId', first.id)
      .firstOrFail()
    assert.equal(promoted.role, 'admin')
  })

  test('quand le dernier membre part, le groupe est supprimé', async ({ client, assert }) => {
    const admin = await createUser()
    const group = await createGroup('Solo', admin, [])

    await client.post(`/groups/${group.id}/leave`).loginAs(admin).withCsrfToken().redirects(0)

    assert.isNull(await Conversation.find(group.id))
  })
})
