import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Conversation from '#models/conversation'
import Message from '#models/message'
import { createGroup, createPrivate, createUser, postMessage } from '#tests/helpers'

test.group('Conversations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un membre peut ouvrir sa conversation', async ({ client }) => {
    const [a, b] = [await createUser('Awa'), await createUser('Ben')]
    const conversation = await createPrivate(a, b)

    const response = await client.get(`/conversations/${conversation.id}`).loginAs(a)

    response.assertStatus(200)
  })

  test('une personne extérieure ne peut pas ouvrir la conversation', async ({ client }) => {
    const [a, b, outsider] = [await createUser(), await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)

    const response = await client.get(`/conversations/${conversation.id}`).loginAs(outsider)

    response.assertStatus(404)
  })

  test('une personne extérieure ne peut pas écrire dans la conversation', async ({
    client,
    assert,
  }) => {
    const [a, b, outsider] = [await createUser(), await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)

    await client
      .post(`/conversations/${conversation.id}/messages`)
      .form({ content: 'Je ne devrais pas pouvoir écrire ici' })
      .loginAs(outsider)
      .withCsrfToken()
      .redirects(0)

    const messages = await Message.query().where('conversationId', conversation.id)
    assert.lengthOf(messages, 0)
  })

  test('une seule conversation privée par paire de personnes', async ({ client, assert }) => {
    const [a, b] = [await createUser(), await createUser()]

    for (let i = 0; i < 2; i++) {
      await client
        .post('/conversations')
        .form({ userId: b.id })
        .loginAs(a)
        .withCsrfToken()
        .redirects(0)
    }

    const conversations = await Conversation.query().where('type', 'private')
    assert.lengthOf(conversations, 1)
  })

  test('la recherche de messages ne renvoie que mes conversations', async ({ client, assert }) => {
    const [a, b, c] = [await createUser('Awa'), await createUser('Ben'), await createUser('Chloé')]
    const privateAB = await createPrivate(a, b)
    const group = await createGroup('Promo', a, [b, c])
    await postMessage(privateAB, a, 'Bonjour Ben, ça va ?')
    await postMessage(group, a, 'Bonjour à tous !')
    await postMessage(group, b, 'Rien à voir ici')

    const forA = await client.get('/search/messages').qs({ q: 'bonjour' }).loginAs(a)
    const forC = await client.get('/search/messages').qs({ q: 'bonjour' }).loginAs(c)

    forA.assertStatus(200)
    assert.lengthOf(forA.body(), 2)
    // Chloé ne fait pas partie de la conversation privée entre Awa et Ben
    assert.deepEqual(
      forC.body().map((result: { title: string }) => result.title),
      ['Promo']
    )
  })

  test('la recherche dans une conversation filtre les messages', async ({ client }) => {
    const [a, b] = [await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)
    await postMessage(conversation, a, 'Rendez-vous demain')
    await postMessage(conversation, b, 'Parfait, à plus tard')

    const response = await client
      .get(`/conversations/${conversation.id}`)
      .qs({ q: 'demain' })
      .loginAs(a)

    response.assertTextIncludes('1 résultat pour « demain »')
    response.assertTextIncludes('Rendez-vous demain')
  })

  test("l'auteur peut modifier son message", async ({ client, assert }) => {
    const [a, b] = [await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)
    const message = await postMessage(conversation, a, 'Rendez-vous à 10h')

    await client
      .post(`/messages/${message.id}/update`)
      .form({ content: 'Rendez-vous à 11h' })
      .loginAs(a)
      .withCsrfToken()
      .redirects(0)

    await message.refresh()
    assert.equal(message.content, 'Rendez-vous à 11h')
    assert.isNotNull(message.editedAt)

    const page = await client.get(`/conversations/${conversation.id}`).loginAs(b)
    page.assertTextIncludes('modifié')
  })

  test("personne d'autre ne peut modifier le message", async ({ client, assert }) => {
    const [a, b] = [await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)
    const message = await postMessage(conversation, a, 'Texte original')

    const response = await client
      .post(`/messages/${message.id}/update`)
      .form({ content: 'Texte piraté' })
      .loginAs(b)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(403)
    await message.refresh()
    assert.equal(message.content, 'Texte original')
  })

  test('un message ne peut pas être vidé en le modifiant', async ({ client, assert }) => {
    const [a, b] = [await createUser(), await createUser()]
    const conversation = await createPrivate(a, b)
    const message = await postMessage(conversation, a, 'Texte original')

    await client
      .post(`/messages/${message.id}/update`)
      .form({ content: '   ' })
      .header('referer', `/conversations/${conversation.id}`)
      .loginAs(a)
      .withCsrfToken()
      .redirects(0)

    await message.refresh()
    assert.equal(message.content, 'Texte original')
    assert.isNull(message.editedAt)
  })
})
