// Checks the permission table in src/lib/auth/permissions.ts and the menu built
// from it, with no server and no database:  node scripts/check-permissions.mjs
//
// It fails (exit 1) when a rule is contradictory, and it lists every row where
// the enforced value is lower than what the permission matrix asks for.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const dir = path.resolve('src/lib/auth')
const cache = {}

// Load a .ts file from src/lib/auth without a build step. Imports from '@/...'
// are type-only and are erased; './x' imports resolve to a sibling file.
function load(name) {
  if (cache[name]) return cache[name].exports
  const source = fs.readFileSync(path.join(dir, name + '.ts'), 'utf8')
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = { exports: {} }
  cache[name] = mod
  const req = (p) => {
    if (p.startsWith('./')) return load(p.slice(2))
    throw new Error('Unexpected runtime import in ' + name + '.ts: ' + p)
  }
  new Function('exports', 'require', 'module', out)(mod.exports, req, mod)
  return mod.exports
}

const perms = load('permissions')
const navConfig = load('admin-nav-config')

const rank = { yes: 2, view: 1, no: 0 }
const roles = ['owner', 'admin', 'principal']
const problems = []
const fail = (msg) => problems.push(msg)

// 1. Table sanity.
const ids = new Map()
for (const [key, row] of Object.entries(perms.CAPS)) {
  if (ids.has(row.id)) fail(`Duplicate matrix id ${row.id}: ${ids.get(row.id)} and ${key}`)
  ids.set(row.id, key)
  for (const role of roles) {
    if (!(row[role] in rank)) fail(`${key}: ${role} has an invalid value "${row[role]}"`)
  }
  // Owner = Admin + Principal + the owner-only rows, so Owner can never have less than either.
  if (rank[row.owner] < rank[row.admin]) fail(`${key} (${row.id}): Admin has more than Owner`)
  if (rank[row.owner] < rank[row.principal]) fail(`${key} (${row.id}): Principal has more than Owner`)
  if (row.owner !== 'yes') fail(`${key} (${row.id}): Owner should always be "yes"`)
  for (const [role, wanted] of Object.entries(row.target ?? {})) {
    if (rank[wanted] <= rank[row[role]]) fail(`${key} (${row.id}): target for ${role} is not above the enforced value`)
  }
}

// 2. The menu refers to real capabilities, and the Owner sees every page.
const caps = new Set(Object.keys(perms.CAPS))
for (const item of navConfig.NAV_ITEMS) {
  for (const c of item.any) if (!caps.has(c)) fail(`Menu item "${item.label}" uses unknown capability ${c}`)
}
for (const tab of navConfig.SCHEDULING_TABS) {
  if (!caps.has(tab.need)) fail(`Scheduling tab "${tab.label}" uses unknown capability ${tab.need}`)
}
const ownerMenu = navConfig.navFor('owner').flatMap((g) => g.items.map((i) => i.label))
for (const item of navConfig.NAV_ITEMS) {
  if (!ownerMenu.includes(item.label)) fail(`The Owner menu is missing "${item.label}"`)
}
const ownerTabs = navConfig.SCHEDULING_TABS.filter((t) => perms.can('owner', t.need))
if (ownerTabs.length !== navConfig.SCHEDULING_TABS.length) fail('The Owner cannot open every Scheduling tab')

// 3. Non-staff roles get nothing.
for (const role of ['teacher', 'parent', 'nanny', undefined, null]) {
  for (const c of caps) if (perms.can(role, c)) fail(`Role ${String(role)} must have no admin-side access, but can use ${c}`)
}

// Report.
const line = '-'.repeat(64)
console.log('Permission table:', caps.size, 'capabilities')
for (const role of roles) {
  const counts = { yes: 0, view: 0, no: 0 }
  for (const c of caps) counts[perms.accessOf(role, c)]++
  console.log(`  ${role.padEnd(10)} yes ${String(counts.yes).padStart(2)}   view ${String(counts.view).padStart(2)}   no ${String(counts.no).padStart(2)}`)
}

console.log('\nMenu per role')
for (const role of roles) {
  const groups = navConfig.navFor(role)
  console.log(`  ${role}: Dashboard | ` + groups.map((g) => `${g.label}: ${g.items.map((i) => i.label).join(', ')}`).join(' | '))
}

const gaps = []
for (const [key, row] of Object.entries(perms.CAPS)) {
  for (const [role, wanted] of Object.entries(row.target ?? {})) {
    gaps.push(`  ${row.id.padEnd(4)} ${role.padEnd(9)} enforced ${row[role].padEnd(4)} matrix asks ${wanted.padEnd(4)} ${row.label}${row.note ? ' (' + row.note + ')' : ''}`)
  }
}
console.log('\nWhere the app enforces less than the matrix asks (' + gaps.length + ')')
console.log(gaps.join('\n') || '  none')

const notBuilt = Object.entries(perms.CAPS).filter(([, r]) => r.built === false).map(([, r]) => `${r.id} ${r.label}`)
console.log('\nNo screen yet (' + notBuilt.length + ')')
console.log(notBuilt.map((s) => '  ' + s).join('\n') || '  none')

console.log('\n' + line)
if (problems.length) {
  console.log('PROBLEMS (' + problems.length + ')')
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
}
console.log('OK: the table is consistent.')
