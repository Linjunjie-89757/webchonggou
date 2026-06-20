import type { ConfigCenterTab } from './types'

export const configCenterTabs: Array<{
  id: ConfigCenterTab
  label: string
  description: string
}> = [
  { id: 'env', label: '环境配置', description: '测试环境管理' },
  { id: 'param', label: '参数配置', description: '全局参数设置' },
  { id: 'dbConnection', label: '数据库连接', description: '数据源配置' },
  { id: 'aiProvider', label: 'AI 连接池', description: '模型服务连接' },
]

export const configEnvTypeOptions = [
  { value: 'TEST', label: '测试' },
  { value: 'STAGING', label: '预发' },
  { value: 'PROD', label: '生产' },
  { value: 'WEB_UI', label: 'Web UI' },
] as const

export const configStatusOptions = [
  { value: 1, label: '启用' },
  { value: 0, label: '停用' },
] as const

export const configParamTypeOptions = [
  { value: 'GLOBAL', label: '全局参数' },
  { value: 'API', label: '接口参数' },
  { value: 'BUSINESS', label: '业务参数' },
  { value: 'WEB_UI_VARIABLE_SET', label: 'Web UI 变量集' },
] as const

export const configDbTypeOptions = [
  { value: 'MYSQL', label: 'MySQL', port: '3306', driver: 'com.mysql.cj.jdbc.Driver' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', port: '5432', driver: 'org.postgresql.Driver' },
  { value: 'REDIS', label: 'Redis', port: '6379', driver: '' },
  { value: 'MONGODB', label: 'MongoDB', port: '27017', driver: '' },
] as const
