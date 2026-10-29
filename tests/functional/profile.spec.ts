import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createUser } from '#tests/helpers'

// Plus petite image PNG valide (1 × 1 pixel)
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

test.group('Photo de profil', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('la photo est gardée dans la base et reste affichable', async ({ client, assert }) => {
    const user = await createUser('Awa')

    const upload = await client
      .post('/profile/avatar')
      .file('avatar', PIXEL, { filename: 'avatar.png' })
      .withCsrfToken()
      .loginAs(user)
      .redirects(0)

    upload.assertStatus(302)
    await user.refresh()
    assert.match(user.avatar!, new RegExp(`^avatars/${user.id}\\?v=\\d+$`))

    const photo = await client.get(`/${user.avatar}`).loginAs(user)
    photo.assertStatus(200)
    photo.assertHeader('content-type', 'image/png')
  })

  test('une photo supprimée ne s’affiche plus', async ({ client, assert }) => {
    const user = await createUser('Ben')

    await client
      .post('/profile/avatar')
      .file('avatar', PIXEL, { filename: 'avatar.png' })
      .withCsrfToken()
      .loginAs(user)

    await client.post('/profile/avatar/delete').withCsrfToken().loginAs(user)

    await user.refresh()
    assert.isNull(user.avatar)
    const photo = await client.get(`/avatars/${user.id}`).loginAs(user)
    photo.assertStatus(404)
  })
})
