const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Exercise the real components/store with a deferred network, without touching
// the shared production database. TypeScript is already a project dependency.
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
    })
    module._compile(result.outputText, filename)
  }
}
require.extensions['.css'] = () => {}
const callbacks = {}
const channel = {
  on(_event, filter, callback) { callbacks[filter.table] = callback; return this },
  subscribe(callback) { callback('SUBSCRIBED'); return this }
}
let finishNode, finishEdge, nodeInput, edgeInput
const updates = []
const api = {
  getNodes: async () => [], getEdges: async () => [],
  getViewport: async () => ({ x: 0, y: 0, zoom: 1 }), getCategories: async () => [],
  createNode: input => { nodeInput = input; return new Promise(resolve => { finishNode = resolve }) },
  createEdge: input => { edgeInput = input; return new Promise(resolve => { finishEdge = resolve }) },
  updateNode: async (id, patch) => { updates.push({ id, patch }) }
}
const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('boardStore.ts') && request === '../lib/api') return api
  if (parent?.filename.endsWith('boardStore.ts') && request === '../lib/supabase') {
    return { supabase: { channel: () => channel, removeChannel: () => {} } }
  }
  return originalLoad.call(this, request, parent, isMain)
}
global.window = { setTimeout, clearTimeout }
global.localStorage = { getItem: () => null }
const { useBoardStore: store } = require('../src/renderer/src/store/boardStore.ts')
const Sidebar = require('../src/renderer/src/components/board/Sidebar.tsx').default
const node = (id, type = 'note') => ({ id, type, data: { title: id }, position: { x: 0, y: 0 } })

async function main() {
  await store.getState().loadBoard('test')
  const creation = store.getState().addNode('note', { x: 4, y: 8 })
  assert.equal(store.getState().nodes.length, 1, 'card appears before saving')
  const id = nodeInput.id
  const edit = store.getState().updateNodeData(id, { title: 'Written before creation finished' })
  assert.equal(updates.length, 0, 'edits wait for the insert')
  store.getState().setNodes(store.getState().nodes.map(n => ({ ...n, selected: true })))
  finishNode(nodeInput)
  await Promise.all([creation, edit])
  assert.equal(updates[0].patch.data.title, 'Written before creation finished')
  callbacks.nodes({ eventType: 'UPDATE', new: { id, type: 'note', data: updates[0].patch.data,
    position_x: 4, position_y: 8, width: 280, height: 160 } })
  assert.equal(store.getState().nodes[0].selected, true, 'save echo keeps resize handles selected')
  store.getState().setNodes(store.getState().nodes.map(n => ({ ...n, resizing: true, style: { width: 420, height: 340 } })))
  callbacks.nodes({ eventType: 'UPDATE', new: { id, type: 'note', data: { title: 'Remote edit' },
    position_x: 4, position_y: 8, width: 280, height: 160 } })
  assert.equal(store.getState().nodes[0].style.height, 340, 'remote edit cannot interrupt resizing')

  const connection = store.getState().addEdge(id, 'other')
  assert.equal(store.getState().edges.length, 1, 'link appears before saving')
  await store.getState().addEdge(id, 'other')
  assert.equal(store.getState().edges.length, 1, 'pending link cannot be duplicated')
  await new Promise(resolve => setImmediate(resolve))
  finishEdge(edgeInput)
  await connection
  assert.equal(store.getState().edges.length, 1)

  const nodes = [node('APP', 'mainIdea'), node('NOTE'), node('GOAL'), node('ISOLATED'), node('SECOND', 'mainIdea')]
  const edges = [
    { id: '1', source: 'APP', target: 'NOTE' }, { id: '2', source: 'NOTE', target: 'APP' },
    { id: '3', source: 'APP', target: 'GOAL' }, { id: '4', source: 'NOTE', target: 'GOAL' },
    { id: '5', source: 'APP', target: 'NOTE' }
  ]
  const html = renderToStaticMarkup(React.createElement(Sidebar, {
    project: { name: 'Test' }, nodes, edges, onAddNode: () => {}
  }))
  for (const n of nodes) {
    assert.equal(html.split('Click to focus &quot;' + n.id + '&quot;').length - 1, 1,
      n.id + ' appears exactly once despite cycles, shared children and duplicate edges')
  }
  // Run the growth hook with deterministic content measurements. The same
  // observer is invoked when the textarea adds lines in the browser.
  let resizeCallback, cleanup
  const content = [{ offsetHeight: 50 }, { offsetHeight: 310 }]
  content.forEach(el => { el.classList = { contains: () => false } })
  const card = { children: content }
  global.ResizeObserver = class {
    constructor(callback) { resizeCallback = callback }
    observe() {}
    disconnect() {}
  }
  const mockLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (parent?.filename.endsWith('useCardGrowth.ts') && request === 'react') {
      return { useRef: () => ({ current: card }), useLayoutEffect: fn => { cleanup = fn() } }
    }
    return mockLoad.call(this, request, parent, isMain)
  }
  store.getState().setNodes([{ ...node('growing'), style: { width: 280, height: 160 } }])
  require('../src/renderer/src/hooks/useCardGrowth.ts').useCardGrowth('growing')
  assert.equal(store.getState().nodes[0].style.height, 362, 'multiline content grows the card immediately')
  content[1].offsetHeight = 450
  resizeCallback()
  assert.equal(store.getState().nodes[0].style.height, 502, 'additional lines grow the card again')
  content[1].offsetHeight = 40
  resizeCallback()
  assert.equal(store.getState().nodes[0].style.height, 502, 'short text preserves manual height')
  cleanup()
  Module._load = mockLoad
  console.log('PASS: immediate creation, deferred edits, persistent selection, uninterrupted resize, immediate links, duplicate prevention, unique tree coverage')
  console.log('PASS: multiline card growth and retained manual height')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
