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
import transmit from '@adonisjs/transmit/services/main'

// Routes du temps réel (l'abonnement à un canal exige d'être connecté)
transmit.registerRoutes((route) => {
  if (route.getPattern() === '__transmit/subscribe') {
    route.middleware(middleware.auth())
  }
})

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
    router.post('/messages/:id/delete', [controllers.Messages, 'destroy']).as('messages.destroy')
    router.get('/groups/new', [controllers.Groups, 'create']).as('groups.create')
    router.post('/groups', [controllers.Groups, 'store']).as('groups.store')
    router.get('/profile', [controllers.Profiles, 'edit']).as('profile.edit')
    router.post('/profile', [controllers.Profiles, 'update']).as('profile.update')
    router.post('/profile/password', [controllers.Profiles, 'updatePassword']).as('profile.password')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())