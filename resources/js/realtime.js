import { Transmit } from '@adonisjs/transmit-client'

// Une seule connexion temps réel par page, uniquement quand on est dans l'application
export const transmit = document.querySelector('.shell')
  ? new Transmit({
      baseUrl: window.location.origin,
      onSubscribeFailed: (response) => {
        console.error('[temps réel] abonnement refusé, code', response.status)
      },
    })
  : null