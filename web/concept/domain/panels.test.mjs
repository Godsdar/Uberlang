import test from 'node:test'
import assert from 'node:assert/strict'
import { NotebookPanels } from './panels.ts'

test('navigation retains tree expansion and syntax state without rebuilding either panel', () => {
  const disposed = []
  const panels = new NotebookPanels(() => ({}), value => disposed.push(value))
  const context = ['water water', 6, 11, null]
  const tree = panels.visit('origins', context).value
  tree.selected = 'German'; tree.expanded = ['Dutch']; tree.zoom = 1.2
  const syntax = panels.visit('grammar', context).value
  syntax.allArcs = true
  panels.visit('understand', context)
  assert.deepEqual(panels.visit('origins', context), { value: tree, fresh: false })
  assert.equal(panels.visit('grammar', context).value.allArcs, true)
  assert.deepEqual(disposed, [])
})

test('changing occurrence, text or live evidence expires hidden views', () => {
  for (const next of [['water water', 6, 11, null], ['edited', 0, 5, null], ['water water', 0, 5, {}]]) {
    const disposed = []
    const panels = new NotebookPanels(() => ({}), value => disposed.push(value))
    const old = ['water water', 0, 5, null]
    const tree = panels.visit('origins', old).value
    const grammar = panels.visit('grammar', old).value
    const updated = panels.visit('grammar', next)
    assert.equal(updated.fresh, true)
    assert.equal(updated.value, grammar, 'active renderer can preserve valid syntax focus')
    assert.deepEqual(disposed, [tree])
    assert.notEqual(panels.visit('origins', next).value, tree)
  }
})

test('in-place sourced-history expansion survives navigation but replacement evidence expires it', () => {
  const evidence = { nodes: ['water'] }
  const panels = new NotebookPanels(() => ({}), () => {})
  const tree = panels.visit('origins', [evidence]).value
  evidence.nodes.push('source')
  panels.visit('understand', [evidence])
  assert.equal(panels.visit('origins', [evidence]).fresh, false)
  assert.equal(panels.visit('origins', [evidence]).value, tree)
  panels.visit('understand', [{ nodes: ['replacement'] }])
  assert.notEqual(panels.visit('origins', [evidence]).value, tree)
})
