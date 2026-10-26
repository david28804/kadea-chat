// Retire les anciennes déclarations recouvertes par une règle plus précise placée plus loin,
// puis vérifie avec les captures et remet celles qui changent le rendu, jusqu'à zéro différence.
// Usage : node dominated.mjs <app.css> <dossier-captures-référence>
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import postcss from 'postcss'

const [cssFile, refDir] = process.argv.slice(2)
const S = 'C:/Users/ADMINI~1/AppData/Local/Temp/claude/c--Users-Administrator-Desktop-KADEA-CHAT/da6a6df6-1b9f-438a-9b23-a5bbdbf4bb13/scratchpad/css'
const original = fs.readFileSync(cssFile, 'utf8')
const norm = (s) => s.replace(/\s+/g, ' ').replace(/"/g, "'").trim()

// Préfixes « plus précis » : un sélecteur `X s` placé plus loin recouvre `s`
const PREFIX = /^(:root(\[data-theme='(dark|light)'\])? )?(body\.(kc|landing) )?(\.lauth |\.lnav |\.newchat |\.chatpane |\.convlist |\.composer |\.empty )?/

function candidatesOf(root) {
  const rules = []
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    rules.push({ rule, selectors: rule.selectors.map(norm) })
  })
  const list = []
  rules.forEach((entry, index) => {
    const later = rules.slice(index + 1)
    entry.rule.nodes.forEach((decl, di) => {
      if (decl.type !== 'decl' || decl.prop.startsWith('--')) return
      const covered = entry.selectors.every((sel) =>
        later.some((other) =>
          other.selectors.some(
            (s2) => s2 !== sel && s2.endsWith(' ' + sel) && PREFIX.test(s2.slice(0, -sel.length)) &&
              other.rule.nodes.some((d) => d.type === 'decl' && d.prop === decl.prop)
          )
        )
      )
      if (covered) list.push({ id: `${index}:${di}`, sel: entry.selectors, prop: decl.prop })
    })
  })
  return list
}

// Une propriété de la capture (forme longue) correspond-elle à la déclaration (parfois raccourcie) ?
const EXTRA = {
  'place-items': ['align-items', 'justify-items'],
  inset: ['top', 'right', 'bottom', 'left'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  'margin-inline': ['margin-left', 'margin-right'],
  'margin-block': ['margin-top', 'margin-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  'padding-block': ['padding-top', 'padding-bottom'],
  font: ['font-size', 'font-weight', 'font-family', 'line-height', 'font-style'],
}
const matchesProp = (declProp, diffProp) =>
  declProp === diffProp ||
  (EXTRA[declProp] || []).includes(diffProp) ||
  declProp.split('-').every((part) => diffProp.split('-').includes(part))

// Les classes de l'élément couvrent-elles la dernière partie du sélecteur ?
const lastClasses = (sel) => (sel.split(/[ >+~]+/).pop().match(/\.[\w-]+/g) || []).map((c) => c.slice(1))
const matchesEl = (sels, elClasses) =>
  sels.some((sel) => {
    const need = lastClasses(sel)
    return need.length === 0 || need.every((c) => elClasses.includes(c))
  })

const allCands = candidatesOf(postcss.parse(original))

// Écrit le CSS sans les candidates dont l'id est dans `removeIds`, puis renvoie les différences
function tryRemoving(removeIds) {
  const root = postcss.parse(original)
  const rules = []
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    rules.push(rule)
  })
  const nodes = [...removeIds].map((id) => {
    const [ri, di] = id.split(':').map(Number)
    return rules[ri].nodes[di]
  })
  nodes.forEach((n) => n.remove())
  root.walkRules((rule) => {
    if (rule.nodes.length === 0) rule.remove()
  })
  root.walkAtRules('media', (at) => {
    if (!at.nodes || at.nodes.length === 0) at.remove()
  })
  fs.writeFileSync(cssFile, root.toString())
  execSync('node -e "setTimeout(()=>{},2000)"')
  fs.rmSync(`${S}/dom`, { recursive: true, force: true })
  execSync(`node ./.css-snap-fast.mjs "${S}/dom"`, { stdio: 'ignore' })
  return JSON.parse(execSync(`node ./.css-cmp.mjs "${refDir}" "${S}/dom" --json`, { maxBuffer: 1e9 }).toString())
}

// Coupe un lot en deux jusqu'à isoler les déclarations retirables sans différence
function bisect(safe, list) {
  if (list.length === 0) return safe
  const diffs = tryRemoving(new Set([...safe, ...list.map((c) => c.id)]))
  console.log(`   essai de ${list.length} : ${diffs.length ? 'différence' : 'ok'}`)
  if (diffs.length === 0) return new Set([...safe, ...list.map((c) => c.id)])
  if (list.length === 1) return safe
  const half = Math.ceil(list.length / 2)
  return bisect(bisect(safe, list.slice(0, half)), list.slice(half))
}

let keep = new Set()
for (let round = 1; round <= 8; round++) {
  const toRemove = allCands.filter((c) => !keep.has(c.id))
  console.log(`tour ${round} : ${toRemove.length} déclaration(s) retirée(s) sur ${allCands.length} candidates`)
  const diffs = tryRemoving(new Set(toRemove.map((c) => c.id)))
  if (diffs.length === 0) {
    console.log('AUCUNE DIFFERENCE')
    process.exit(0)
  }
  // On remet les candidates qui touchent une propriété changée sur un élément concerné
  let added = 0
  for (const c of toRemove) {
    if (diffs.some((d) => matchesProp(c.prop, d.prop) && matchesEl(c.sel, d.classes))) {
      keep.add(c.id)
      added++
    }
  }
  console.log(`   ${diffs.length} différence(s) -> ${added} déclaration(s) remise(s)`)
  if (added === 0) {
    // L'heuristique ne trouve pas la cause : on cherche par dichotomie
    console.log('   recherche par dichotomie…')
    const safe = bisect(new Set(), toRemove)
    const finalDiffs = tryRemoving(safe)
    console.log(`${safe.size} déclaration(s) retirée(s) au final : ${finalDiffs.length ? 'DIFFERENCES' : 'AUCUNE DIFFERENCE'}`)
    if (finalDiffs.length) fs.writeFileSync(cssFile, original)
    process.exit(finalDiffs.length ? 1 : 0)
  }
}
fs.writeFileSync(cssFile, original)
console.log('Trop de tours, retour au fichier de départ')
