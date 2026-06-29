import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildApiDefinitionSaveDraft,
  validateApiDefinitionSaveDraft,
} from '../src/widgets/api-interface-workspace/lib/apiDefinitionSaveDialog.ts'

test('api definition save dialog derives a useful default name for new requests', () => {
  const draft = buildApiDefinitionSaveDraft({
    currentName: '新建请求',
    requestPath: '/admin/commodity/activity/saveOrUpdate',
    currentDirectoryName: null,
    selectedDirectoryName: 'order-admin/商品',
  })

  assert.equal(draft.name, 'saveOrUpdate')
  assert.equal(draft.directoryName, 'order-admin/商品')
})

test('api definition save dialog keeps an explicit user name over path fallback', () => {
  const draft = buildApiDefinitionSaveDraft({
    currentName: '保存优惠券订单',
    requestPath: '/orders/coupon/save',
    currentDirectoryName: '',
    selectedDirectoryName: 'order-admin/优惠券订单',
  })

  assert.equal(draft.name, '保存优惠券订单')
})

test('api definition save dialog requires name and directory before create', () => {
  assert.deepEqual(
    validateApiDefinitionSaveDraft({ name: '', directoryName: 'order-admin' }),
    { valid: false, message: '请输入接口名称' },
  )
  assert.deepEqual(
    validateApiDefinitionSaveDraft({ name: '保存订单', directoryName: '' }),
    { valid: false, message: '请选择保存目录' },
  )
  assert.deepEqual(
    validateApiDefinitionSaveDraft({ name: '保存订单', directoryName: 'order-admin/订单' }),
    { valid: true },
  )
})
