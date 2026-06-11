export const apiMethodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export const apiRunResultOptions = [
  { label: '未执行', value: '' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '错误', value: 'ERROR' },
  { label: '跳过', value: 'SKIPPED' },
] as const
