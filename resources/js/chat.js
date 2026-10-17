
import './chat.js'
import { Transmit } from '@adonisjs/transmit-client'

// On cherche la zone des messages (elle n'existe que dans une conversation ouverte)
const box = document.querySelector('[data-conversation-id]')

if (box) {
  const conversationId = box.dataset.conversationId
  const myId = Number(box.dataset.userId)
  const isGroup = box.dataset.group === '1'

  const transmit = new Transmit({
    baseUrl: window.location.origin,
    onSubscribeFailed: (response) => {
      console.error('Abonnement au temps réel refusé, code', response.status)
    },
  })

  const subscription = transmit.subscription(`conversations/${conversationId}`)

  subscription.onMessage((data) => {
    // Évite d'afficher deux fois le même message
    if (box.querySelector(`[data-message-id="${data.id}"]`)) return

    const empty = box.querySelector('.msgs__empty')
    if (empty) empty.remove()

    const mine = data.senderId === myId
    const bubble = document.createElement('div')
    bubble.className = 'msg' + (mine ? ' msg--mine' : '')
    bubble.dataset.messageId = data.id

    if (isGroup && !mine) {
      const author = document.createElement('span')
      author.className = 'msg__author'
      author.textContent = data.author
      bubble.appendChild(author)
    }

    const text = document.createElement('span')
    text.className = 'msg__text'
    text.textContent = data.content
    bubble.appendChild(text)

    const time = document.createElement('span')
    time.className = 'msg__time'
    time.textContent = data.time
    bubble.appendChild(time)

    box.appendChild(bubble)
    box.scrollTop = box.scrollHeight
  })

  subscription.create().catch((error) => {
    console.error('Temps réel indisponible', error)
  })
}
