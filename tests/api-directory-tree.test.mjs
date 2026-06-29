import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildApiDirectoryTree,
  collectCollapsedDirectoryKeys,
  collectExpandableDirectoryKeys,
  definitionModuleLoadKey,
  findDirectoryNodeByKey,
} from '../src/widgets/api-interface-workspace/lib/apiDirectoryTree.ts'

const workspace = {
  code: 'XMAN',
  workspaceCode: 'XMAN',
  name: 'X-MAN',
  workspaceName: 'X-MAN',
}

const moduleNode = {
  id: 33,
  workspaceCode: 'XMAN',
  name: '订单',
  fullPath: '企微侧边栏/订单',
  definitionCount: 2,
  children: [],
}

test('buildApiDirectoryTree keeps unloaded leaf modules expandable with placeholder', () => {
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set(),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.label, '订单')
  assert.equal(leaf.count, 2)
  assert.equal(leaf.children.length, 1)
  assert.equal(leaf.children[0].type, 'placeholder')
  assert.equal(leaf.children[0].label, '')
})

test('buildApiDirectoryTree shows loading placeholder before request rows while module is loading', () => {
  const key = definitionModuleLoadKey('XMAN', 33, '企微侧边栏/订单')
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set([key]),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.children[0].type, 'placeholder')
  assert.equal(leaf.children[0].label, '加载接口中...')
  assert.equal(leaf.children[0].loading, true)
})

test('buildApiDirectoryTree renders loaded requests under their module', () => {
  const key = definitionModuleLoadKey('XMAN', 33, '企微侧边栏/订单')
  const definition = {
    id: 1001,
    workspaceCode: 'XMAN',
    name: '创建订单',
    method: 'POST',
    directoryName: '企微侧边栏/订单',
  }
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [definition],
    loadedModuleKeys: new Set([key]),
    loadingModuleKeys: new Set(),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.children.length, 1)
  assert.equal(leaf.children[0].type, 'request')
  assert.equal(leaf.children[0].label, '创建订单')
  assert.equal(leaf.children[0].definition, definition)
})

test('directory tree helpers collect keys and find nested nodes', () => {
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set(),
  })

  assert.deepEqual(collectCollapsedDirectoryKeys(tree), ['definition-root', 'workspace:XMAN'])
  assert.equal(collectExpandableDirectoryKeys(tree).includes('module:XMAN:33'), true)
  assert.equal(findDirectoryNodeByKey(tree, 'module:XMAN:33')?.label, '订单')
  assert.equal(findDirectoryNodeByKey(tree, 'missing'), null)
})
