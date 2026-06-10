import { configApi, type ConfigStatus, type EnvConfigItem } from '@/entities/config'

export async function toggleConfigEnvStatus(env: EnvConfigItem, workspaceCode = 'ALL') {
  const nextStatus: ConfigStatus = env.status === 1 ? 0 : 1
  await configApi.updateSettingsEnvStatus(workspaceCode, env.id, nextStatus)
  return nextStatus
}
