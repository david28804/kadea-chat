import { transmit } from './realtime.js'

const shell = document.querySelector('.shell')

if (shell && transmit) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content ?? ''

  // Signe de vie envoyé au serveur
  const ping = () => {
    fetch('/presence/ping', {
      method: 'POST',
      headers: { 'X-CSRF-TOKEN': token },
      credentials: 'same-origin',
    }).catch(() => {})
  }

  // Allume ou éteint la pastille de la personne concernée (et son statut sous le nom)
  const setOnline = (userId, online) => {
    document.querySelectorAll(`[data-presence-user="${userId}"]`).forEach((element) => {
      element.classList.toggle('is-online', online)
      if (element.hasAttribute('data-presence-label')) {
        element.textContent = online ? 'En ligne' : 'Hors ligne'
      }
    })
  }

  const subscription = transmit.subscription('presence')
  subscription.onMessage((data) => setOnline(data.userId, data.online))
  subscription
    .create()
    .then(ping)
    .catch((error) => console.error('[temps réel] présence indisponible', error))

  // Un signe de vie toutes les 25 secondes, tant que l'onglet est visible
  setInterval(() => {
    if (!document.hidden) ping()
  }, 25000)

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ping()
  })
}