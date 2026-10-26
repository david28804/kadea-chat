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

// Liste des conversations : filtres, et recherche d'un mot dans tous les messages
Alpine.data('convList', function () {
  return {
    q: '',
    f: 'all',
    results: [],
    searching: false,
    searchedFor: '',

    // Une conversation reste visible si son nom correspond et qu'elle passe le filtre
    ok(el) {
      const title = el.dataset.title.toLowerCase().includes(this.q.trim().toLowerCase())
      const filter =
        this.f === 'all' ||
        (this.f === 'unread' && Number(el.dataset.unread) > 0) ||
        (this.f === 'groups' && el.dataset.group === '1')
      return title && filter
    },

    // Appelée pendant la frappe (avec un petit délai) : cherche le mot dans les messages
    async findMessages() {
      const query = this.q.trim()
      if (query.length < 2) {
        this.results = []
        this.searchedFor = ''
        return
      }
      this.searching = true
      try {
        const url = `${this.$root.dataset.searchUrl}?q=${encodeURIComponent(query)}`
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        const results = response.ok ? await response.json() : []
        // On ignore une réponse arrivée après une nouvelle frappe
        if (query !== this.q.trim()) return
        this.results = results
        this.searchedFor = query
      } finally {
        this.searching = false
      }
    },

    // Découpe l'extrait en morceaux pour surligner le mot (affiché avec x-text, sans HTML)
    parts(text) {
      const needle = this.searchedFor.toLowerCase()
      const lower = text.toLowerCase()
      const parts = []
      let from = 0
      let at = needle ? lower.indexOf(needle) : -1
      while (at !== -1) {
        if (at > from) parts.push({ text: text.slice(from, at), hit: false })
        parts.push({ text: text.slice(at, at + needle.length), hit: true })
        from = at + needle.length
        at = lower.indexOf(needle, from)
      }
      if (from < text.length) parts.push({ text: text.slice(from), hit: false })
      return parts
    },
  }
})

Alpine.start()