export function normalizeSwaggerPathVariables(path: string | null | undefined) {
  return (path || '').replace(/(?<!\{)\{([A-Za-z_][A-Za-z0-9_.-]*)\}(?!\})/g, '{{$1}}')
}
