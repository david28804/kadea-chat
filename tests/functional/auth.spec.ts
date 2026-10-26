import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import { createUser, PASSWORD } from '#tests/helpers'

test.group('Authentification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("l'inscription crée un compte non confirmé et envoie un e-mail", async ({
    client,
    assert,
  }) => {
    const { messages } = mail.fake()

    const response = await client
      .post('/signup')
      .form({
        fullName: 'Awa Diallo',
        email: 'awa@example.test',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    const user = await User.findByOrFail('email', 'awa@example.test')
    assert.isNull(user.emailVerifiedAt)
    messages.assertSent({ to: 'awa@example.test' })
    mail.restore()
  })

  test("la connexion est refusée tant que l'e-mail n'est pas confirmé", async ({ client }) => {
    const user = await createUser()
    user.emailVerifiedAt = null
    await user.save()

    const response = await client
      .post('/login')
      .form({ email: user.email, password: PASSWORD })
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
    response.assertFlashMessage('error')
  })

  test('un compte confirmé se connecte et arrive sur ses conversations', async ({ client }) => {
    const user = await createUser()

    const response = await client
      .post('/login')
      .form({ email: user.email, password: PASSWORD })
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/dashboard')
  })

  test('un mauvais mot de passe est refusé', async ({ client }) => {
    const user = await createUser()

    const response = await client
      .post('/login')
      .form({ email: user.email, password: 'mauvais-mot-de-passe' })
      // Le formulaire est envoyé depuis la page de connexion, qui sert de retour en cas d'erreur
      .header('referer', '/login')
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('les conversations sont réservées aux personnes connectées', async ({ client }) => {
    const response = await client.get('/dashboard').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test("la déconnexion ramène à l'accueil", async ({ client }) => {
    const user = await createUser()

    const response = await client.post('/logout').loginAs(user).withCsrfToken().redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/')
  })
})
