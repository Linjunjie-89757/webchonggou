import {
  parseParamContent,
  type ConfigStatus,
  type CreateParamPayload,
  type ParamSetItem,
} from '@/entities/config'

export type ConfigParamDialogMode = 'create' | 'edit'

export interface ConfigParamForm {
  workspaceCode: string
  paramType: string
  paramName: string
  value: string
  description: string
  sensitive: boolean
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
    status: 1,
  }
}

export function createConfigParamFormFromItem(item: ParamSetItem): ConfigParamForm {
  const content = parseParamContent(item.contentJson)

  return {
    workspaceCode: item.workspaceCode || 'ALL',
    paramType: item.paramType || 'GLOBAL',
    paramName: item.paramName,
    value: content.value,
    description: content.description,
    sensitive: content.sensitive,
    status: item.status,
  }
}

export function buildCreateParamPayload(form: ConfigParamForm): CreateParamPayload {
  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    paramType: form.paramType,
    paramName: form.paramName.trim(),
    contentJson: JSON.stringify({
      value: form.value.trim(),
      description: form.description.trim(),
      sensitive: form.sensitive,
    }),
    status: form.status,
  }
}

export function validateConfigParamForm(form: ConfigParamForm) {
  if (!form.paramName.trim()) {
    return '请输入参数名'
  }
  if (!form.value.trim()) {
    return '请输入参数值'
  }
  return ''
}
