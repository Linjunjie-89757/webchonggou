import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveOpenTarget } from './session.mjs';

test('resolveOpenTarget opens an explicit URL when provided', () => {
  assert.deepEqual(
    resolveOpenTarget({
      requestedUrl: ' https://example.test/orders ',
      hasActivePage: true,
      currentUrl: 'https://example.test/dashboard',
    }),
    {
      action: 'OPEN_URL',
      url: 'https://example.test/orders',
    },
  );
});

test('resolveOpenTarget reuses the current page when URL is omitted', () => {
  assert.deepEqual(
    resolveOpenTarget({
      requestedUrl: '',
      hasActivePage: true,
      currentUrl: 'https://example.test/orders',
    }),
    {
      action: 'REUSE_CURRENT_PAGE',
      url: 'https://example.test/orders',
    },
  );
});

test('resolveOpenTarget requires URL when no active page exists', () => {
  assert.throws(
    () => resolveOpenTarget({
      requestedUrl: '',
      hasActivePage: false,
      currentUrl: '',
    }),
    /url is required when there is no active page/,
  );
});
