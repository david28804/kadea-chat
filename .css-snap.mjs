// Capture le style calculé de chaque élément, dans de nombreux états de l'application.
// Usage : node snapshot.mjs <dossier-de-sortie>
import { chromium } from 'playwright'
import fs from 'node:fs'
const OUT = process.argv[2]
const S = 'C:/Users/ADMINI~1/AppData/Local/Temp/claude/c--Users-Administrator-Desktop-KADEA-CHAT/da6a6df6-1b9f-438a-9b23-a5bbdbf4bb13/scratchpad/css'
const { conv, grp } = JSON.parse(fs.readFileSync(`${S}/ids.json`, 'utf8'))
fs.mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:3333', PASS = 'motdepasse123'
const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 }

const PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-bottom-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'color', 'background-color', 'background-image', 'background-attachment', 'box-shadow', 'opacity', 'visibility', 'overflow-x', 'overflow-y',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
  'text-underline-offset', 'white-space', 'text-overflow', 'overflow-wrap', 'vertical-align', 'list-style-type',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'justify-content', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'place-items', 'order', 'transform', 'translate', 'scale', 'filter', 'backdrop-filter',
  'outline-style', 'outline-color', 'outline-width', 'cursor', 'accent-color', 'object-fit', 'content', 'fill', 'stroke']

async function capture(page, name, { forcePseudo = false } = {}) {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
  const data = await page.evaluate(({ PROPS, forcePseudo }) => {
    if (forcePseudo) {
      // Chaque règle :hover/:focus est dupliquée juste après l'originale avec une classe,
      // puis la classe est mise sur tous les éléments : « tout est survolé »
      const walk = (list) => {
        for (let i = list.cssRules.length - 1; i >= 0; i--) {
          const rule = list.cssRules[i]
          if (rule.cssRules && !rule.selectorText) { walk(rule); continue }
          if (rule.selectorText && /:(hover|focus)/.test(rule.selectorText)) {
            const sel = rule.selectorText.replace(/:hover|:focus-visible|:focus-within|:focus/g, '.__h')
            try { list.insertRule(`${sel}{${rule.style.cssText}}`, i + 1) } catch {}
          }
        }
      }
      for (const sheet of document.styleSheets) { try { walk(sheet) } catch {} }
      document.querySelectorAll('*').forEach((el) => el.classList.add('__h'))
    }
    const out = []
    const els = [document.documentElement, ...document.querySelectorAll('html *')]
    const pathOf = (el) => {
      const p = []
      while (el && el.nodeType === 1) {
        const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0
        p.unshift(el.tagName.toLowerCase() + ':' + i)
        el = el.parentElement
      }
      return p.join('/')
    }
    for (const el of els) {
      if (['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD'].includes(el.tagName)) continue
      const rec = { p: pathOf(el), c: (el.getAttribute('class') || '').replace(/\s*__h/g, '') }
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo)
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue
        const v = {}
        for (const prop of PROPS) v[prop] = cs.getPropertyValue(prop)
        rec[pseudo || 'self'] = v
      }
      out.push(rec)
    }
    return out
  }, { PROPS, forcePseudo })
  fs.writeFileSync(`${OUT}/${name}${forcePseudo ? '.hover' : ''}.json`, JSON.stringify(data))
}

const browser = await chromium.launch({ channel: 'msedge' })
async function ctxFor(viewport, theme, login) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([{ name: 'app_theme', value: theme, url: BASE }])
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  if (login) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', login)
    await page.fill('#password', PASS)
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')])
  }
  return { ctx, page }
}
const go = (page, url) => page.goto(BASE + url, { waitUntil: 'networkidle' })
const A = 'kc-css-a@example.test'
const openMembers = async (p) => {
  await p.click('button[title="Membres du groupe"]')
  await p.click('.groupinfo__add summary')
}
const newchat = (label) => async (p) => {
  await p.click('.convnav__item--new')
  if (label) await p.click(`.newchat__option:has-text("${label}")`)
}
const listSearch = async (p) => {
  await p.type('.convlist__search input', 'bonjour')
  await p.waitForSelector('.msgresult')
  await p.waitForTimeout(300)
}
const liveFilter = async (p) => {
  await p.click('.chatsearch button[type=button]')
  await p.type('.chatsearch input', 'dem')
}
const states = [
  // [nom, viewport, thème, connecté, url, action, survol forcé]
  ['home-d-dark', D, 'dark', null, '/', null, true],
  ['home-d-light', D, 'light', null, '/', null, true],
  ['home-m-dark', M, 'dark', null, '/', (p) => p.click('.lnav__burger'), false],
  ['home-m-light', M, 'light', null, '/', (p) => p.click('.lnav__burger'), false],
  ['login-dark', D, 'dark', null, '/login', null, true],
  ['login-light', D, 'light', null, '/login', null, false],
  ['signup-dark', D, 'dark', null, '/signup', null, false],
  ['forgot-dark', D, 'dark', null, '/forgot-password', null, false],
  ['notfound-dark', D, 'dark', null, '/nexiste-pas', null, false],
  ['login-m-dark', M, 'dark', null, '/login', null, false],
  ['dash-dark', D, 'dark', A, '/dashboard', null, true],
  ['dash-light', D, 'light', A, '/dashboard', null, true],
  ['conv-dark', D, 'dark', A, `/conversations/${conv}`, null, true],
  ['conv-light', D, 'light', A, `/conversations/${conv}`, null, true],
  ['block-dark', D, 'dark', A, `/conversations/${conv}`, (p) => p.click('.blockbox summary'), false],
  ['group-dark', D, 'dark', A, `/conversations/${grp}`, openMembers, true],
  ['group-light', D, 'light', A, `/conversations/${grp}`, openMembers, false],
  ['newchat-choice-dark', D, 'dark', A, '/dashboard', newchat(null), true],
  ['newchat-private-dark', D, 'dark', A, '/dashboard', newchat('Nouvelle conversation'), true],
  ['newchat-group-dark', D, 'dark', A, '/dashboard', newchat('Créer un groupe'), false],
  ['newchat-group-light', D, 'light', A, '/dashboard', newchat('Créer un groupe'), false],
  ['convsearch-dark', D, 'dark', A, `/conversations/${conv}?q=bonjour`, null, false],
  ['convsearch-light', D, 'light', A, `/conversations/${conv}?q=bonjour`, null, false],
  ['livefilter-dark', D, 'dark', A, `/conversations/${conv}`, liveFilter, false],
  ['listsearch-dark', D, 'dark', A, '/dashboard', listSearch, true],
  ['listsearch-light', D, 'light', A, '/dashboard', listSearch, false],
  ['profile-dark', D, 'dark', A, '/profile', null, true],
  ['profile-light', D, 'light', A, '/profile', null, false],
  ['conv-m-dark', M, 'dark', A, `/conversations/${conv}`, null, false],
  ['dash-m-dark', M, 'dark', A, '/dashboard', null, false],
  ['conv-t-dark', { width: 900, height: 800 }, 'dark', A, `/conversations/${conv}`, null, false],
]
for (const [name, vp, theme, login, url, action, hover] of states) {
  for (const forcePseudo of hover ? [false, true] : [false]) {
    const { ctx, page } = await ctxFor(vp, theme, login)
    await go(page, url)
    if (action) await action(page)
    await page.waitForTimeout(150)
    await capture(page, name, { forcePseudo })
    await ctx.close()
  }
  process.stdout.write('.')
}
console.log('\ncaptures:', fs.readdirSync(OUT).length)
await browser.close()
