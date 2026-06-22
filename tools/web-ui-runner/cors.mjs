const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isAllowedRunnerOrigin(origin, configuredOrigins = []) {
  if (!origin) {
    return false;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
