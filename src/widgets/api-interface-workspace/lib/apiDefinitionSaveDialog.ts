export interface ApiDefinitionSaveDraft {
  name: string
  directoryName: string
}

export interface BuildApiDefinitionSaveDraftOptions {
  currentName?: string | null
  requestPath?: string | null
  currentDirectoryName?: string | null
  selectedDirectoryName?: string | null
}

export interface ApiDefinitionSaveDraftValidation {
  valid: boolean
  message?: string
}

const DRAFT_NAMES = new Set(['', '新建请求', '未命名接口'])

function normalizeText(value?: string | null) {
  return (value || '').trim()
}

function inferNameFromPath(path?: string | null) {
  const cleanPath = normalizeText(path).split('?')[0]?.replace(/\/+$/, '') || ''
  const segments = cleanPath.split('/').map(item => item.trim()).filter(Boolean)
  return segments.at(-1) || ''
}

export function buildApiDefinitionSaveDraft(options: BuildApiDefinitionSaveDraftOptions): ApiDefinitionSaveDraft {
  const currentName = normalizeText(options.currentName)
  const inferredName = inferNameFromPath(options.requestPath)
  const name = DRAFT_NAMES.has(currentName) ? inferredName || '新建请求' : currentName

  return {
    name,
    directoryName: normalizeText(options.currentDirectoryName) || normalizeText(options.selectedDirectoryName),
  }
}

export function validateApiDefinitionSaveDraft(draft: ApiDefinitionSaveDraft): ApiDefinitionSaveDraftValidation {
  if (!normalizeText(draft.name)) {
    return { valid: false, message: '请输入接口名称' }
  }
  if (!normalizeText(draft.directoryName)) {
    return { valid: false, message: '请选择保存目录' }
  }
  return { valid: true }
}
