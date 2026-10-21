import transmit from '@adonisjs/transmit/services/main'

// Une personne est "en ligne" si elle a donné signe de vie il y a moins de 45 secondes
const ONLINE_WINDOW_MS = 45_000

type PresenceState = {
  lastSeen: Map<number, number>
  online: Set<number>
  timer: NodeJS.Timeout | null
}

// L'état est gardé sur globalThis pour survivre aux rechargements du mode développement
const globalState = globalThis as unknown as { __kadeaPresence?: PresenceState }
const state: PresenceState = (globalState.__kadeaPresence ??= {
  lastSeen: new Map(),
  online: new Set(),
  timer: null,
})

export default class PresenceService {
  static isOnline(userId: number) {
    return state.online.has(userId)
  }

  /**
   * Enregistre un signe de vie. Annonce l'arrivée si la personne était absente.
   */
  static touch(userId: number) {
    state.lastSeen.set(userId, Date.now())

    if (!state.online.has(userId)) {
      state.online.add(userId)
      transmit.broadcast('presence', { userId, online: true })
    }
  }
}

// Toutes les 15 secondes, on retire ceux qui n'ont plus donné signe de vie
if (!state.timer) {
  state.timer = setInterval(() => {
    const now = Date.now()

    for (const userId of [...state.online]) {
      const seen = state.lastSeen.get(userId) ?? 0
      if (now - seen > ONLINE_WINDOW_MS) {
        state.online.delete(userId)
        transmit.broadcast('presence', { userId, online: false })
      }
    }
  }, 15_000)
  state.timer.unref()
}
