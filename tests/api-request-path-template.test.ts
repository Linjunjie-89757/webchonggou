import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSwaggerPathVariables } from '../src/widgets/api-scenario-workspace/lib/apiRequestPathTemplate.ts'

test('normalizes swagger path variables to runtime variable syntax', () => {
  assert.equal(
    normalizeSwaggerPathVariables('/order-admin/admin/commodity/detail/{id}'),
    '/order-admin/admin/commodity/detail/{{id}}',
  )
})

test('keeps existing runtime variables unchanged', () => {
  assert.equal(
    normalizeSwaggerPathVariables('/order-admin/admin/commodity/detail/{{id}}'),
    '/order-admin/admin/commodity/detail/{{id}}',
  )
})

test('normalizes multiple path variables in one path', () => {
  assert.equal(
    normalizeSwaggerPathVariables('/users/{userId}/orders/{orderId}'),
    '/users/{{userId}}/orders/{{orderId}}',
  )
})
