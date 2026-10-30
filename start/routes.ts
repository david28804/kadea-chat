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

// Accueil : présentation de Kadea Chat
router.on('/').render('pages/home').as('home')

router
  .get('email/confirm/:token', [controllers.EmailConfirmations, 'handle'])
  .as('email.confirm')

// Pages de connexion : toujours accessibles, même déjà connecté
router.get('signup', [controllers.NewAccount, 'create'])
router.post('signup', [controllers.NewAccount, 'store'])

router.get('login', [controllers.Session, 'create'])
router.post('login', [controllers.Session, 'store'])

router.get('forgot-password', [controllers.PasswordResets, 'create']).as('password.forgot')
router.post('forgot-password', [controllers.PasswordResets, 'store']).as('password.store')
router.get('reset-password/:token', [controllers.PasswordResets, 'edit']).as('password.edit')
router.post('reset-password/:token', [controllers.PasswordResets, 'update']).as('password.update')

router
  .group(() => {
    router.get('/dashboard', [controllers.Conversations, 'index']).as('dashboard')
    router
      .get('/search/messages', [controllers.Conversations, 'searchMessages'])
      .as('messages.search')
    router.get('/conversations/:id', [controllers.Conversations, 'show']).as('conversations.show')
    router.post('/conversations', [controllers.Conversations, 'store']).as('conversations.store')
    router.post('/conversations/:id/messages', [controllers.Messages, 'store']).as('messages.store')
    router.post('/conversations/:id/typing', [controllers.Messages, 'typing']).as('messages.typing')
    router.post('/conversations/:id/read', [controllers.Messages, 'read']).as('messages.read')
    router.get('/attachments/:id', [controllers.Messages, 'attachment']).as('attachments.show')
    router.post('/messages/:id/delete', [controllers.Messages, 'destroy']).as('messages.destroy')
    router.post('/messages/:id/update', [controllers.Messages, 'update']).as('messages.update')
    router.post('/users/:id/block', [controllers.Blocks, 'store']).as('users.block')
    router.post('/users/:id/unblock', [controllers.Blocks, 'destroy']).as('users.unblock')
    router.post('/presence/ping', [controllers.Presences, 'ping']).as('presence.ping')
    router.post('/groups', [controllers.Groups, 'store']).as('groups.store')
    router
      .post('/groups/:id/members', [controllers.Groups, 'addMembers'])
      .as('groups.members.add')
    router
      .post('/groups/:id/members/:userId/remove', [controllers.Groups, 'removeMember'])
      .as('groups.members.remove')
    router.post('/groups/:id/leave', [controllers.Groups, 'leave']).as('groups.leave')
    router.get('/profile', [controllers.Profiles, 'edit']).as('profile.edit')
    router.post('/profile', [controllers.Profiles, 'update']).as('profile.update')
    router.post('/profile/password', [controllers.Profiles, 'updatePassword']).as('profile.password')
    router.get('/avatars/:id', [controllers.Profiles, 'showAvatar']).as('avatars.show')
    router.post('/profile/avatar', [controllers.Profiles, 'updateAvatar']).as('profile.avatar')
    router
      .post('/profile/avatar/delete', [controllers.Profiles, 'destroyAvatar'])
      .as('profile.avatar.destroy')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

// Partie admin : réservée aux adresses listées dans ADMIN_EMAILS
router
  .group(() => {
    router.get('/admin', [controllers.Admin, 'index']).as('admin.index')
    router.post('/admin/users/:id/delete', [controllers.Admin, 'destroy']).as('admin.users.destroy')
  })
  .use([middleware.auth(), middleware.admin()])