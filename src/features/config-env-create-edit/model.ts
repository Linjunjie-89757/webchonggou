import type { ConfigStatus, CreateEnvPayload, EnvConfigItem } from '@/entities/config'

export type ConfigEnvDialogMode = 'create' | 'edit'

export interface ConfigEnvForm {
  workspaceCode: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  status: ConfigStatus
}

export function createDefaultConfigEnvForm(workspaceCode = 'ALL'): ConfigEnvForm {
  return {
    workspaceCode,
    envType: 'TEST',
    envName: '',
    baseUrl: '',
    configJson: '',
    status: 1,
  }
}

export function createConfigEnvFormFromItem(item: EnvConfigItem): ConfigEnvForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    envType: item.envType || 'TEST',
    envName: item.envName,
    baseUrl: item.baseUrl,
    configJson: item.configJson ?? '',
    status: item.status,
  }
}

export function buildCreateEnvPayload(form: ConfigEnvForm): CreateEnvPayload {
  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    envType: form.envType,
    envName: form.envName.trim(),
    baseUrl: form.baseUrl.trim(),
    configJson: form.configJson.trim(),
    status: form.status,
  }
}

export function validateConfigEnvForm(form: ConfigEnvForm) {
  if (!form.envName.trim()) {
    return '请输入环境名称'
  }
  if (!form.baseUrl.trim()) {
    return '请输入 Base URL'
  }
  if (!/^https?:\/\//i.test(form.baseUrl.trim())) {
    return 'Base URL 必须以 http:// 或 https:// 开头'
  }
  return ''
}
