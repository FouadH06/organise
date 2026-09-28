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
let finishNode, finishEdge, rejectEdge, nodeInput, edgeInput
const updates = []
const api = {
  getNodes: async () => [], getEdges: async () => [],
  getViewport: async () => ({ x: 0, y: 0, zoom: 1 }), getCategories: async () => [],
  createNode: input => { nodeInput = input; return new Promise(resolve => { finishNode = resolve }) },
  createEdge: input => { edgeInput = input; return new Promise((resolve, reject) => { finishEdge = resolve; rejectEdge = reject }) },
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
  callbacks.nodes({ eventType: 'UPDATE', new: { id, project_id: 'test', type: 'note', data: updates[0].patch.data,
    position_x: 4, position_y: 8, width: 280, height: 160 } })
  assert.equal(store.getState().nodes[0].selected, true, 'save echo keeps resize handles selected')
  store.getState().setNodes(store.getState().nodes.map(n => ({ ...n, resizing: true, style: { width: 420, height: 340 } })))
  callbacks.nodes({ eventType: 'UPDATE', new: { id, project_id: 'test', type: 'note', data: { title: 'Remote edit' },
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

  const unrelated = { id: 'unrelated', source: 'x', target: 'y' }
  store.getState().setEdges([...store.getState().edges, unrelated])
  const reparent = store.getState().addEdge('new-parent', 'other', { sourceHandle: 'top', targetHandle: 'right' })
  assert.equal(store.getState().edges.filter(e => e.target === 'other').length, 1)
  assert.equal(store.getState().edges.find(e => e.target === 'other').source, 'new-parent',
    'new parent immediately replaces old incoming link')
  assert.ok(store.getState().edges.some(e => e.id === 'unrelated'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(edgeInput.sourceHandle, 'top')
  assert.equal(edgeInput.targetHandle, 'right')
  finishEdge(edgeInput)
  await reparent
  const savedParent = store.getState().edges.find(e => e.target === 'other')
  const moved = store.getState().addEdge('third-parent', 'different-child', {}, savedParent.id)
  assert.ok(!store.getState().edges.some(e => e.id === savedParent.id), 'moving endpoint removes old edge immediately')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(edgeInput.replacedEdgeId, savedParent.id, 'endpoint reconnect persists old-edge removal')
  const errorLogger = console.error
  console.error = () => {}
  rejectEdge(new Error('Network unavailable'))
  await moved
  console.error = errorLogger
  assert.ok(store.getState().edges.some(e => e.target === 'different-child'), 'unsaved intent remains visible for retry')
  assert.ok(store.getState().error, 'failed reconnect is visible to the user')
  assert.equal(store.getState().pendingSaves, 1)
  const retry = store.getState().retrySaves()
  finishEdge(edgeInput)
  await retry
  assert.equal(store.getState().pendingSaves, 0)
  assert.equal(store.getState().error, null)
  const { encodeEdgeLabel, decodeEdgeLabel } = require('../src/renderer/src/lib/edgeHandles.ts')
  assert.deepEqual(decodeEdgeLabel(encodeEdgeLabel('Caption', 'top', 'left')),
    { label: 'Caption', sourceHandle: 'top', targetHandle: 'left' })
  assert.deepEqual(decodeEdgeLabel('Legacy label'),
    { label: 'Legacy label', sourceHandle: 'bottom', targetHandle: 'top' })
  console.log('PASS: parent replacement, endpoint reconnection, retry and saved connector sides')

  let resolveSnapshot
  api.getNodes = () => new Promise(resolve => { resolveSnapshot = resolve })
  const loading = store.getState().loadBoard('test')
  await new Promise(resolve => setImmediate(resolve))
  callbacks.nodes({ eventType: 'UPDATE', new: { id: 'edited', project_id: 'test', type: 'note',
    data: { title: 'New text' }, position_x: 0, position_y: 0, width: 280, height: 160 } })
  callbacks.nodes({ eventType: 'DELETE', old: { id: 'deleted' } })
  resolveSnapshot([node('edited'), node('deleted')])
  await loading
  assert.equal(store.getState().nodes.find(n => n.id === 'edited').data.title, 'New text')
  assert.ok(!store.getState().nodes.some(n => n.id === 'deleted'), 'snapshot cannot resurrect deleted cards')
  api.getNodes = async () => []

  const successfulUpdate = api.updateNode
  api.updateNode = async () => { throw new Error('Offline') }
  await store.getState().updateNodeData('edited', { description: 'Keep this draft' })
  assert.equal(store.getState().pendingSaves, 1)
  assert.ok(store.getState().error)
  await store.getState().updateNodeData('edited', { customBg: '#f5f5f2' })
  callbacks.nodes({ eventType: 'UPDATE', new: { id: 'edited', project_id: 'test', type: 'note',
    data: { title: 'Collaborator title', description: 'Old text' }, position_x: 0, position_y: 0 } })
  assert.equal(store.getState().nodes[0].data.description, 'Keep this draft', 'pending fields survive remote updates')
  assert.equal(store.getState().nodes[0].data.title, 'Collaborator title', 'other fields still update live')
  api.updateNode = successfulUpdate
  await store.getState().retrySaves()
  assert.equal(store.getState().pendingSaves, 0)
  assert.deepEqual(updates.at(-2).patch.data, { description: 'Keep this draft' }, 'save only edited fields')
  assert.deepEqual(updates.at(-1).patch.data, { customBg: '#f5f5f2' })

  const deletions = []
  api.deleteNode = async id => { deletions.push(id) }
  const { applyBoardNodeChanges } = require('../src/renderer/src/lib/nodeChanges.ts')
  applyBoardNodeChanges([{ type: 'remove', id: 'edited' }], store.getState())
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(deletions, ['edited'], 'keyboard removal reaches persistence')
  assert.equal(store.getState().nodes.length, 0)

  let firstSnapshot
  api.getNodes = () => new Promise(resolve => { firstSnapshot = resolve })
  const firstLoad = store.getState().loadBoard('test')
  await new Promise(resolve => setImmediate(resolve))
  api.getNodes = async () => [node('fresh')]
  await store.getState().loadBoard('test')
  firstSnapshot([node('stale')])
  await firstLoad
  assert.deepEqual(store.getState().nodes.map(n => n.id), ['fresh'], 'old same-project load cannot overwrite new session')
  console.log('PASS: load races, pending field protection, failure/retry order, keyboard deletion and cancelled loads')

  const { CARD_COLORS, getCardColor } = require('../src/renderer/src/lib/cardColors.ts')
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  for (const c of CARD_COLORS) {
    for (const fg of [c.text, c.muted]) {
      const [high, low] = [luminance(fg), luminance(c.bg)].sort((a, b) => b - a)
      assert.ok((high + 0.05) / (low + 0.05) >= 4.5, c.label + ' text contrast')
    }
    assert.equal(getCardColor(c.legacy).id, c.id, 'old palette values migrate visually')
  }
  console.log('PASS: all palette text contrast ratios exceed 4.5:1; legacy colors map correctly')

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
