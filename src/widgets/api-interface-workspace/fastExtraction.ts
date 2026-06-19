export type FastExtractionMode = 'JSON_PATH' | 'X_PATH' | 'REGEX'
export type FastExtractionExpressionRule = 'EXPRESSION' | 'GROUP'
export type FastExtractionResponseFormat = 'JSON' | 'XML' | 'HTML'

export interface FastExtractionConfig {
  expression?: string
  extractType?: FastExtractionMode
  expressionMatchingRule?: FastExtractionExpressionRule
  responseFormat?: FastExtractionResponseFormat
}

function stringifyMatchValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function readJsonPathSegment(source: unknown, segment: string): unknown {
  if (source === null || source === undefined) return undefined
  if (/^\d+$/.test(segment) && Array.isArray(source)) return source[Number(segment)]
  if (typeof source === 'object') return (source as Record<string, unknown>)[segment]
  return undefined
}

export function matchJsonPath(source: string, expression: string): string[] {
  const parsed = JSON.parse(source || '{}')
  const normalized = expression.trim()
  if (!normalized || normalized === '$') return [stringifyMatchValue(parsed)].filter(Boolean)
  if (!normalized.startsWith('$')) return []

  const segments = [...normalized.matchAll(/\.([A-Za-z_$][\w$-]*)|\[(\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]/g)]
    .map((match) => {
      if (match[1]) return match[1]
      const raw = match[2]
      if (/^\d+$/.test(raw)) return raw
      return JSON.parse(raw.replace(/^'/, '"').replace(/'$/, '"')) as string
    })

  let current: unknown = parsed
  for (const segment of segments) {
    current = readJsonPathSegment(current, segment)
  }
  return [stringifyMatchValue(current)].filter(Boolean)
}

export function matchRegex(
  source: string,
  expression: string,
  rule: FastExtractionExpressionRule = 'EXPRESSION',
): string[] {
  const normalized = expression.trim().replace(/^\/|\/g?$|\/gs?$/g, '')
  if (!normalized) return []
  const matches = [...source.matchAll(new RegExp(normalized, 'gs'))]
  if (rule === 'GROUP') {
    return matches.flatMap(match => match.slice(1).filter(item => item !== undefined).map(String))
  }
  return matches.map(match => match[0])
}

export function matchXPath(
  source: string,
  expression: string,
  responseFormat: FastExtractionResponseFormat = 'XML',
): string[] {
  if (!expression.trim()) return []
  const parserType = responseFormat === 'HTML' ? 'text/html' : 'text/xml'
  const doc = new DOMParser().parseFromString(source || '', parserType)
  const result = doc.evaluate(expression, doc, null, XPathResult.ANY_TYPE, null)
  const values: string[] = []

  let node = result.iterateNext()
  while (node) {
    values.push(node.textContent ?? '')
    node = result.iterateNext()
  }
  if (values.length) return values

  const scalar = doc.evaluate(expression, doc, null, XPathResult.STRING_TYPE, null).stringValue
  return scalar ? [scalar] : []
}

export function testFastExtraction(source: string, config: FastExtractionConfig): string[] {
  const mode = config.extractType || 'JSON_PATH'
  const expression = config.expression || ''
  if (mode === 'REGEX') return matchRegex(source, expression, config.expressionMatchingRule || 'EXPRESSION')
  if (mode === 'X_PATH') return matchXPath(source, expression, config.responseFormat || 'XML')
  return matchJsonPath(source, expression)
}

export function buildJsonPathSegment(basePath: string, key: string | number): string {
  if (typeof key === 'number') return `${basePath}[${key}]`
  if (/^[A-Za-z_$][\w$-]*$/.test(key)) return basePath === '$' ? `$.${key}` : `${basePath}.${key}`
  return `${basePath}[${JSON.stringify(key)}]`
}

export function buildXPathSegment(basePath: string, nodeName: string, index?: number): string {
  const segment = index && index > 1 ? `${nodeName}[${index}]` : nodeName
  return !basePath || basePath === '/' ? `/${segment}` : `${basePath}/${segment}`
}
