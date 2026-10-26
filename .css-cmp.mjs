// Compare deux séries de captures : node compare.mjs <avant> <après> [--json]
import fs from 'node:fs'
const [A, B, mode] = process.argv.slice(2)
const json = mode === '--json'
const all = []
let total = 0
const log = (...args) => {
  if (!json) console.log(...args)
}
for (const file of fs.readdirSync(A)) {
  const a = JSON.parse(fs.readFileSync(`${A}/${file}`, 'utf8'))
  const b = JSON.parse(fs.readFileSync(`${B}/${file}`, 'utf8'))
  if (a.length !== b.length) {
    log(file, 'nombre d elements different', a.length, b.length)
    all.push({ file, classes: [], prop: '*' })
    total++
    continue
  }
  const diffs = []
  a.forEach((ea, i) => {
    const eb = b[i]
    for (const part of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
      if (part === 'p' || part === 'c') continue
      const va = ea[part] || {}
      const vb = eb[part] || {}
      for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) {
        // Écarts de moins de 0,1 px : bruit de rendu des polices, pas une vraie différence
        const na = parseFloat(va[k])
        const nb = parseFloat(vb[k])
        const tiny =
          /^-?[\d.]+px$/.test(va[k] ?? '') && /^-?[\d.]+px$/.test(vb[k] ?? '') && Math.abs(na - nb) < 0.1
        if (va[k] !== vb[k] && !tiny) {
          diffs.push(`${ea.c || ea.p.split('/').pop()} ${part} ${k}: ${va[k]} -> ${vb[k]}`)
          all.push({ file, classes: ea.c.split(/\s+/).filter(Boolean), prop: k })
        }
      }
    }
  })
  if (diffs.length) {
    total += diffs.length
    log(`\n${file}: ${diffs.length} difference(s)`)
    ;[...new Set(diffs)].slice(0, 15).forEach((d) => log('  ', d))
  }
}
if (json) console.log(JSON.stringify(all))
else console.log(total ? `\nTOTAL: ${total} difference(s)` : '\nAUCUNE DIFFERENCE')
