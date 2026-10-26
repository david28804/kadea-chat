// Liste (ou retire avec --write) les sélecteurs CSS qui visent une classe utilisée nulle part.
// Usage : node dead.mjs <app.css> [--write]
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const [cssFile, flag] = process.argv.slice(2)
const ROOT = process.cwd()

// Tous les « mots » présents dans les vues, les scripts et le code serveur
const words = new Set()
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(edge|js|ts)$/.test(entry.name)) {
      for (const w of fs.readFileSync(full, 'utf8').match(/[A-Za-z_][\w-]*/g) || []) words.add(w)
    }
  }
}
for (const dir of ['resources/views', 'resources/js', 'app', 'node_modules/edge-iconify']) {
  if (fs.existsSync(path.join(ROOT, dir))) walk(path.join(ROOT, dir))
}
// Classes ajoutées par des bibliothèques ou par le navigateur
for (const w of ['__h', 'alert--success', 'alert--destructive', 'alert--default']) words.add(w)

const root = postcss.parse(fs.readFileSync(cssFile, 'utf8'))
const dead = []
let removedSelectors = 0
let removedRules = 0
root.walkRules((rule) => {
  if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
  const keep = rule.selectors.filter((sel) => {
    const classes = sel.match(/\.[A-Za-z_][\w-]*/g) || []
    return classes.every((c) => words.has(c.slice(1)))
  })
  if (keep.length === rule.selectors.length) return
  const gone = rule.selectors.filter((s) => !keep.includes(s))
  dead.push(`${rule.source.start.line}: ${gone.join(', ')}`)
  removedSelectors += gone.length
  if (keep.length === 0) {
    removedRules++
    rule.remove()
  } else {
    rule.selectors = keep
  }
})
// Les blocs @media devenus vides disparaissent aussi
root.walkAtRules('media', (at) => {
  if (!at.nodes || at.nodes.length === 0) at.remove()
})

console.log(dead.join('\n'))
console.log(`\n${removedSelectors} sélecteur(s) mort(s), ${removedRules} règle(s) entièrement supprimée(s)`)
if (flag === '--write') fs.writeFileSync(cssFile, root.toString())
