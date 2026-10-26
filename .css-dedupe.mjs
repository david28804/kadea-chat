// Retire les déclarations toujours écrasées plus loin : même sélecteur, même propriété,
// redéfinie par une règle placée après, sans condition plus restrictive.
// Usage : node dedupe.mjs <app.css> [--write]
import fs from 'node:fs'
import postcss from 'postcss'

const [cssFile, flag] = process.argv.slice(2)
const root = postcss.parse(fs.readFileSync(cssFile, 'utf8'))

const norm = (s) => s.replace(/\s+/g, ' ').replace(/"/g, "'").trim()

// Contexte d'une règle : '' au premier niveau, sinon les conditions @media empilées
const contextOf = (rule) => {
  const parts = []
  let p = rule.parent
  while (p && p.type !== 'root') {
    if (p.type === 'atrule') parts.unshift(`@${p.name} ${p.params}`)
    p = p.parent
  }
  return parts.join(' | ')
}

// Toutes les règles, dans l'ordre du fichier
const rules = []
root.walkRules((rule) => {
  if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
  rules.push({ rule, ctx: contextOf(rule), selectors: rule.selectors.map(norm) })
})

let removed = 0
rules.forEach((entry, index) => {
  const later = rules.slice(index + 1).filter(
    // Une règle plus loin l'emporte toujours si elle est au premier niveau,
    // ou dans exactement le même contexte @media
    (other) => other.ctx === '' || other.ctx === entry.ctx
  )
  entry.rule.walkDecls((decl) => {
    if (decl.parent !== entry.rule) return
    const prop = decl.prop.toLowerCase()
    if (prop.startsWith('--')) {
      // Variables : même logique, la dernière définition l'emporte
    }
    const overridden = entry.selectors.every((sel) =>
      later.some(
        (other) =>
          other.selectors.includes(sel) &&
          other.rule.nodes.some(
            (d) =>
              d.type === 'decl' &&
              d.prop.toLowerCase() === prop &&
              (d.important || !decl.important)
          )
      )
    )
    if (overridden) {
      decl.remove()
      removed++
    }
  })
})

// Règles devenues vides, puis blocs @media vides
let emptied = 0
root.walkRules((rule) => {
  if (rule.nodes.filter((n) => n.type === 'decl').length === 0 && !rule.nodes.some((n) => n.type === 'rule')) {
    rule.remove()
    emptied++
  }
})
root.walkAtRules('media', (at) => {
  if (!at.nodes || at.nodes.length === 0) at.remove()
})

console.log(`${removed} déclaration(s) écrasée(s) retirée(s), ${emptied} règle(s) vidée(s) supprimée(s)`)
if (flag === '--write') fs.writeFileSync(cssFile, root.toString())
