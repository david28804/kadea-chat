import { Transmit } from '@adonisjs/transmit-client'

// On cherche la zone des messages (elle n'existe que dans une conversation ouverte)
const box = document.querySelector('[data-conversation-id]')

if (box && box.dataset.live === '1') {
  const conversationId = box.dataset.conversationId
  const myId = Number(box.dataset.userId)
  const isGroup = box.dataset.group === '1'

  const transmit = new Transmit({
    baseUrl: window.location.origin,
    onSubscribeFailed: (response) => {
      console.error('[temps réel] abonnement refusé, code', response.status)
    },
  })

  const subscription = transmit.subscription(`conversations/${conversationId}`)

  subscription.onMessage((data) => {
    // Un message a été supprimé : on remplace son contenu
    if (data.type === 'deleted') {
      const bubble = box.querySelector(`[data-message-id="${data.id}"]`)
      if (bubble) {
        const text = bubble.querySelector('.msg__text')
        if (text) text.remove()

        const trash = bubble.querySelector('.msg__del')
        if (trash) trash.remove()

        if (!bubble.querySelector('.msg__deleted')) {
          const note = document.createElement('span')
          note.className = 'msg__deleted'
          note.textContent = 'Ce message a été supprimé'
          const anchor = bubble.querySelector('.msg__foot') || bubble.querySelector('.msg__time')
          bubble.insertBefore(note, anchor)
        }
      }
      return
    }

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

    const foot = document.createElement('div')
    foot.className = 'msg__foot'
    const time = document.createElement('span')
    time.className = 'msg__time'
    time.textContent = data.time
    foot.appendChild(time)
    bubble.appendChild(foot)

    box.appendChild(bubble)
    box.scrollTop = box.scrollHeight
  })

  subscription.create().catch((error) => {
    console.error('[temps réel] indisponible', error)
  })
}