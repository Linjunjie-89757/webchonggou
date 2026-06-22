import {
  parseParamContent,
  type ConfigStatus,
  type CreateParamPayload,
  type ParamSetItem,
} from '@/entities/config'

export type ConfigParamDialogMode = 'create' | 'edit'

export interface WebUiVariableItem {
  name: string
  value: string
  sensitive: boolean
  description: string
}

export interface ConfigParamForm {
  workspaceCode: string
  paramType: string
  paramName: string
  value: string
  description: string
  sensitive: boolean
  variables: WebUiVariableItem[]
  status: ConfigStatus
}

export function createDefaultConfigParamForm(workspaceCode = 'ALL'): ConfigParamForm {
  return {
    workspaceCode,
    paramType: 'GLOBAL',
    paramName: '',
    value: '',
    description: '',
    sensitive: false,
    variables: [createDefaultWebUiVariable()],
    status: 1,
  }
}

export function createDefaultWebUiVariableSetForm(workspaceCode = 'ALL'): ConfigParamForm {
  return {
    ...createDefaultConfigParamForm(workspaceCode),
    paramType: 'WEB_UI_VARIABLE_SET',
  }
}

export function createConfigParamFormFromItem(item: ParamSetItem): ConfigParamForm {
  const content = parseParamContent(item.contentJson)
  const variables = parseWebUiVariables(item.contentJson)

  return {
    workspaceCode: item.workspaceCode || 'ALL',
    paramType: item.paramType || 'GLOBAL',
    paramName: item.paramName,
    value: content.value,
    description: content.description,
    sensitive: content.sensitive,
    variables: variables.length > 0 ? variables : [createDefaultWebUiVariable()],
    status: item.status,
  }
}

export function buildCreateParamPayload(form: ConfigParamForm): CreateParamPayload {
  const contentJson = form.paramType === 'WEB_UI_VARIABLE_SET'
    ? JSON.stringify(
        form.variables
          .map(variable => ({
            name: variable.name.trim(),
            value: variable.value,
            sensitive: variable.sensitive,
            description: variable.description.trim(),
          }))
          .filter(variable => variable.name),
      )
    : JSON.stringify({
        value: form.value.trim(),
        description: form.description.trim(),
        sensitive: form.sensitive,
      })

  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    paramType: form.paramType,
    paramName: form.paramName.trim(),
    contentJson,
    status: form.status,
  }
}

export function validateConfigParamForm(form: ConfigParamForm) {
  if (!form.paramName.trim()) {
    return '请输入参数名'
  }
  if (form.paramType === 'WEB_UI_VARIABLE_SET') {
    const activeVariables = form.variables.filter(variable => variable.name.trim() || variable.value.trim())
    if (activeVariables.length === 0) {
      return '请至少添加一个变量'
    }

    const names = new Set<string>()
    for (const variable of activeVariables) {
      const name = variable.name.trim()
      if (!name) {
        return '变量名不能为空'
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return `变量名 ${name} 只能包含字母、数字、下划线，且不能以数字开头`
      }

      const upperName = name.toUpperCase()
      if (names.has(upperName)) {
        return `变量名 ${name} 重复`
      }
      names.add(upperName)
    }
    return ''
  }
  if (!form.value.trim()) {
    return '请输入参数值'
  }
  return ''
}

export function createDefaultWebUiVariable(): WebUiVariableItem {
  return {
    name: '',
    value: '',
    sensitive: false,
    description: '',
  }
}

export function parseWebUiVariables(contentJson: string): WebUiVariableItem[] {
  const raw = contentJson?.trim()
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const source = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.variables)
        ? parsed.variables
        : []

    return source
      .filter(isRecord)
      .map(item => ({
        name: typeof item.name === 'string' ? item.name : '',
        value: typeof item.value === 'string' ? item.value : '',
        sensitive: item.sensitive === true || item.isSecret === true,
        description: typeof item.description === 'string'
          ? item.description
          : typeof item.desc === 'string'
            ? item.desc
            : '',
      }))
      .filter(item => item.name.trim())
  } catch {
    return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
