/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')

router
  .get('email/confirm/:token', [controllers.EmailConfirmations, 'handle'])
  .as('email.confirm')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])

    router.get('forgot-password', [controllers.PasswordResets, 'create']).as('password.forgot')
    router.post('forgot-password', [controllers.PasswordResets, 'store']).as('password.store')
    router.get('reset-password/:token', [controllers.PasswordResets, 'edit']).as('password.edit')
    router
      .post('reset-password/:token', [controllers.PasswordResets, 'update'])
      .as('password.update')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.get('/dashboard', [controllers.Conversations, 'index']).as('dashboard')
    router.get('/conversations/new', [controllers.Conversations, 'create']).as('conversations.create')
    router.get('/conversations/:id', [controllers.Conversations, 'show']).as('conversations.show')
    router.post('/conversations', [controllers.Conversations, 'store']).as('conversations.store')
    router.post('/conversations/:id/messages', [controllers.Messages, 'store']).as('messages.store')
    router.get('/groups/new', [controllers.Groups, 'create']).as('groups.create')
    router.post('/groups', [controllers.Groups, 'store']).as('groups.store')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())