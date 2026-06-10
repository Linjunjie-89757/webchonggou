export const casePriorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
] as const

export const caseReviewStatusOptions = [
  { label: '未评审', value: 'PENDING' },
  { label: '已通过', value: 'PASSED' },
  { label: '不通过', value: 'REJECTED' },
] as const

export const caseExecutionStatusOptions = [
  { label: '未执行', value: 'NOT_RUN' },
  { label: '已通过', value: 'PASSED' },
  { label: '阻塞中', value: 'BLOCKED' },
  { label: '失败', value: 'FAILED' },
] as const
