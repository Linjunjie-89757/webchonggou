import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedRunnerOrigin, parseAllowedOrigins } from './cors.mjs';

test('allows common local frontend origins on any port', () => {
  assert.equal(isAllowedRunnerOrigin('http://localhost:4173'), true);
  assert.equal(isAllowedRunnerOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedRunnerOrigin('http://127.0.0.1:4173'), true);
});

test('keeps non-local origins blocked unless explicitly configured', () => {
  assert.equal(isAllowedRunnerOrigin('https://example.com'), false);
  assert.equal(isAllowedRunnerOrigin('https://example.com', ['https://example.com']), true);
});

test('parses comma separated configured origins', () => {
  assert.deepEqual(
    parseAllowedOrigins('https://auto.test, http://10.0.0.8:4173,'),
    ['https://auto.test', 'http://10.0.0.8:4173'],
  );
});
