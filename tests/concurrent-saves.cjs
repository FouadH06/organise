const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText, filename)

// Model conditional database writes: both clients read the same version, but
// only one update can match it. The losing client must merge and retry.
let row = { id: 'card', data: JSON.stringify({ title: 'Title', description: 'Original' }), updated_at: 1 }
let collisions = 0
const database = {
  from() {
    let patch, version
    const query = {
      select() {
        if (!patch) return query
        if (version !== row.updated_at) { collisions++; return Promise.resolve({ data: [], error: null }) }
        row = { ...row, ...patch }
        return Promise.resolve({ data: [{ id: row.id }], error: null })
      },
      eq(key, value) { if (key === 'updated_at') version = value; return query },
      is(key, value) { if (key === 'updated_at') version = value; return query },
      update(value) { patch = value; return query },
      single() { return Promise.resolve({ data: { ...row }, error: null }) }
    }
    return query
  }
}
const original = Module._load
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('api.ts') && request === './supabase') return { supabase: database }
  return original.call(this, request, parent, isMain)
}
const { updateNode } = require('../src/renderer/src/lib/api.ts')
;(async () => {
  await Promise.all([
    updateNode('card', { data: { description: 'Friend wrote this' } }),
    updateNode('card', { data: { customBg: '#203b32' } })
  ])
  assert.deepEqual(JSON.parse(row.data), { title: 'Title', description: 'Friend wrote this', customBg: '#203b32' })
  assert.equal(collisions, 1, 'test must actually force a conflicting write')
  await Promise.all([
    updateNode('card', { position: { x: 320, y: 64 } }),
    updateNode('card', { width: 480, height: 280 })
  ])
  assert.equal(row.position_x, 320)
  assert.equal(row.width, 480)
  assert.equal(row.height, 280)
  console.log('PASS: concurrent text/color changes and position/size changes survive version conflicts')
})().catch(error => { console.error(error); process.exitCode = 1 })
