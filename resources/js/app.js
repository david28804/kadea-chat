import Alpine from 'alpinejs'
import './realtime.js'
import './presence.js'
import './chat.js'
import './avatar.js'
import './landing.js'

Alpine.data('alert', function () {
  return {
    isVisible: false,
    dismiss() {
      this.isVisible = false
    },
    init() {
      setTimeout(() => {
        this.isVisible = true
      }, 80)
      setTimeout(() => {
        this.dismiss()
      }, 5000)
    },
  }
})

Alpine.data('themeToggle', function () {
  return {
    theme: 'light',
    init() {
      this.theme = this.$el.dataset.initialTheme || 'light'
    },
    toggle() {
      const next = this.theme === 'dark' ? 'light' : 'dark'
      this.theme = next
      document.documentElement.setAttribute('data-theme', next)
      document.cookie = `app_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    },
  }
})

// Fenêtre « Nouveau » : choix, conversation privée ou groupe
Alpine.data('newChat', function () {
  return {
    step: 'choice',
    q: '',
    init() {
      // Réouverture après une erreur du formulaire (ex. groupe sans membre)
      const step = this.$root.dataset.openStep
      if (step) this.open(step)
    },
    open(step) {
      this.step = step || 'choice'
      this.q = ''
      if (!this.$root.open) this.$root.showModal()
    },
    close() {
      this.$root.close()
    },
    match(el) {
      return el.dataset.search.includes(this.q.trim().toLowerCase())
    },
  }
})

Alpine.start()