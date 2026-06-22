export function resolveOpenTarget({ requestedUrl, hasActivePage, currentUrl }) {
  const url = optionalString(requestedUrl);
  if (url) {
    return {
      action: 'OPEN_URL',
      url,
    };
  }

  if (hasActivePage) {
    return {
      action: 'REUSE_CURRENT_PAGE',
      url: optionalString(currentUrl),
    };
  }

  throw new Error('url is required when there is no active page');
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
