import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { DateTime } from 'luxon'
import { createPrivate, createUser, PASSWORD, postMessage } from '#tests/helpers'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'

// Adresse déclarée dans ADMIN_EMAILS (.env.test)
async function createAdmin() {
  return User.create({
    fullName: 'Admin Kadea',
    email: 'admin@example.test',
    password: PASSWORD,
    emailVerifiedAt: DateTime.now(),
  })
}

test.group('Administration', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("un utilisateur simple n'a pas accès à la partie admin", async ({ client }) => {
    const user = await createUser('Awa')

    const response = await client.get('/admin').loginAs(user)

    response.assertStatus(404)
  })

  test("le lien vers l'administration n'apparaît que pour l'administrateur", async ({
    client,
    assert,
  }) => {
    const admin = await createAdmin()
    const user = await createUser('Awa')

    const forAdmin = await client.get('/dashboard').loginAs(admin)
    const forUser = await client.get('/dashboard').loginAs(user)

    assert.include(forAdmin.text(), 'href="/admin"')
    assert.notInclude(forUser.text(), 'href="/admin"')
  })

  test('une personne non connectée est renvoyée vers la connexion', async ({ client }) => {
    const response = await client.get('/admin').redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test("l'administrateur voit les chiffres et la liste des utilisateurs", async ({ client }) => {
    const admin = await createAdmin()
    await createUser('Awa Diallo')

    const response = await client.get('/admin').loginAs(admin)

    response.assertStatus(200)
    response.assertTextIncludes('Awa Diallo')
    response.assertTextIncludes('Admin Kadea')
  })

  test('la recherche filtre la liste par nom ou par adresse', async ({ client, assert }) => {
    const admin = await createAdmin()
    await createUser('Awa Diallo')
    await createUser('Ben Kasongo')

    const response = await client.get('/admin').qs({ q: 'kasongo' }).loginAs(admin)

    response.assertStatus(200)
    response.assertTextIncludes('Ben Kasongo')
    assert.notInclude(response.text(), 'Awa Diallo')
  })

  test("l'administrateur peut supprimer un utilisateur sans effacer l'historique partagé", async ({
    client,
    assert,
  }) => {
    const admin = await createAdmin()
    const user = await createUser('Awa Diallo')
    const conversation = await createPrivate(admin, user)
    const message = await postMessage(conversation, user, 'Message conservé')

    const response = await client
      .post(`/admin/users/${user.id}/delete`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin')
    assert.isNull(await User.find(user.id))
    assert.isNull((await Message.find(message.id))?.senderId)
    const membership = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .where('userId', admin.id)
      .first()
    assert.isNotNull(membership)
  })

  test("l'administrateur ne peut pas supprimer son propre compte", async ({ client, assert }) => {
    const admin = await createAdmin()

    const response = await client
      .post(`/admin/users/${admin.id}/delete`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin')
    assert.isNotNull(await User.find(admin.id))
  })

  test("un compte administrateur est protégé contre la suppression", async ({
    client,
    assert,
  }) => {
    const admin = await createAdmin()
    const otherAdmin = await User.create({
      fullName: 'Second Admin',
      email: 'second-admin@example.test',
      password: PASSWORD,
      emailVerifiedAt: DateTime.now(),
    })

    const response = await client
      .post(`/admin/users/${otherAdmin.id}/delete`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin')
    assert.isNotNull(await User.find(otherAdmin.id))
  })

  test("un utilisateur simple ne peut pas supprimer un compte", async ({ client, assert }) => {
    const user = await createUser()
    const target = await createUser('Awa Diallo')

    const response = await client
      .post(`/admin/users/${target.id}/delete`)
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(404)
    assert.isNotNull(await User.find(target.id))
  })
})
