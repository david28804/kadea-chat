import { transmit } from './realtime.js'

// On cherche la zone des messages (elle n'existe que dans une conversation ouverte)
const box = document.querySelector('[data-conversation-id]')

// 1234567 -> "1.2 Mo"
function formatSize(bytes) {
  if (typeof bytes !== 'number') return String(bytes ?? '')
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

if (box && transmit && box.dataset.live === '1') {
  const conversationId = box.dataset.conversationId
  const myId = Number(box.dataset.userId)
  const isGroup = box.dataset.group === '1'

  const subscription = transmit.subscription(`conversations/${conversationId}`)

  // Dit au serveur « j'ai lu cette conversation » (la coche passe en bleu chez l'autre)
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content ?? ''
  function markRead() {
    fetch(`/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: { 'X-CSRF-TOKEN': csrf, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    }).catch(() => {})
  }

  subscription.onMessage((data) => {
    // Un message a été supprimé : on remplace son contenu
    if (data.type === 'deleted') {
      const bubble = box.querySelector(`[data-message-id="${data.id}"]`)
      if (bubble) {
        bubble.querySelectorAll('.msg__text, .msg__image, .msg__file, .msg__del, .msg__tick').forEach(
          (element) => element.remove()
        )

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

    // L'autre personne a lu la conversation : mes coches passent en « lu »
    if (data.type === 'read') {
      if (!isGroup && data.userId !== myId) {
        box.querySelectorAll('.msg--mine .msg__tick').forEach((tick) => {
          tick.dataset.status = 'read'
          tick.textContent = '✓✓'
        })
      }
      return
    }

    // Seuls les nouveaux messages créent une bulle
    if (data.type !== 'new') return

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

    // Fichier joint : image affichée, ou lien de téléchargement
    if (data.attachment) {
      if (data.attachment.isImage) {
        const link = document.createElement('a')
        link.className = 'msg__image'
        link.href = data.attachment.url
        link.target = '_blank'
        link.rel = 'noopener'

        const picture = document.createElement('img')
        picture.src = data.attachment.url
        picture.alt = data.attachment.name
        link.appendChild(picture)
        bubble.appendChild(link)
      } else {
        const link = document.createElement('a')
        link.className = 'msg__file'
        link.href = data.attachment.url

        const icon = document.createElement('span')
        icon.textContent = '📄'
        const name = document.createElement('span')
        name.className = 'msg__filename'
        name.textContent = data.attachment.name
        const size = document.createElement('span')
        size.className = 'msg__filesize'
        size.textContent = formatSize(data.attachment.size)

        link.append(icon, name, size)
        bubble.appendChild(link)
      }
    }

    if (data.content) {
      const text = document.createElement('span')
      text.className = 'msg__text'
      text.textContent = data.content
      bubble.appendChild(text)
    }

    const foot = document.createElement('div')
    foot.className = 'msg__foot'
    const time = document.createElement('span')
    time.className = 'msg__time'
    time.textContent = data.time
    foot.appendChild(time)

    if (mine) {
      const tick = document.createElement('span')
      tick.className = 'msg__tick'
      tick.dataset.status = 'sent'
      tick.title = 'Statut du message'
      tick.textContent = '✓'
      foot.appendChild(tick)
    }

    bubble.appendChild(foot)

    box.appendChild(bubble)
    box.scrollTop = box.scrollHeight

    // Je regarde la conversation : le message de l'autre est lu tout de suite
    if (!mine) markRead()
  })

  subscription.create().catch((error) => {
    console.error('[temps réel] indisponible', error)
  })
}