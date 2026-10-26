// Page d'accueil : le paragraphe [data-reveal] s'éclaire mot après mot au défilement
const block = document.querySelector('[data-reveal]')

if (block) {
  const words = block.textContent.trim().split(/\s+/)
  block.textContent = ''
  const spans = words.map((word) => {
    const span = document.createElement('span')
    span.textContent = `${word} `
    block.append(span)
    return span
  })

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function update() {
    const rect = block.getBoundingClientRect()
    const vh = window.innerHeight
    // 0 quand le paragraphe entre par le bas, 1 quand il atteint le tiers haut de l'écran
    const progress = reduce ? 1 : Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.6)))
    const lit = Math.round(progress * spans.length)
    spans.forEach((span, i) => span.classList.toggle('is-lit', i < lit))
  }

  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
}
