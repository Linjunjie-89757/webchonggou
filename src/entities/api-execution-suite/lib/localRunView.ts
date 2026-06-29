import type { ApiExecutionSuiteRunHistoryItem } from '../model/types'

export interface ApiSuiteLocalRunNoticeInput {
  runId?: string | null
  history?: Pick<ApiExecutionSuiteRunHistoryItem, 'id' | 'result'> | null
}

export function findLatestSuiteLocalRunnerHistory(histories: ApiExecutionSuiteRunHistoryItem[]) {
  return [...histories]
    .filter(item => String(item.runOn || '').toUpperCase() === 'LOCAL_RUNNER')
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || '') || 0
      const rightTime = Date.parse(right.createdAt || '') || 0
      if (leftTime !== rightTime) return rightTime - leftTime
      return right.id - left.id
    })[0] || null
}

export function buildApiSuiteLocalRunNotice(input: ApiSuiteLocalRunNoticeInput) {
  const runId = input.runId || null
  const history = input.history || null
  if (!runId && !history) {
    return {
      visible: false,
      title: '',
      description: '',
      tone: 'info',
      reportKey: null,
    }
  }
  if (history?.id) {
    return {
      visible: true,
      title: 'Local Runner 套件报告已生成',
      description: `正式报告已回写到套件运行记录，任务 ${runId || '-'} 可继续追溯。`,
      tone: statusTone(history.result),
      reportKey: `suite:${history.id}`,
    }
  }
  return {
    visible: true,
    title: 'Local Runner 套件任务已创建',
    description: `任务 ${runId || '-'} 正在等待本地执行器回传结果，完成后可查看正式套件报告。`,
    tone: 'primary',
    reportKey: null,
  }
}

function statusTone(status?: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'DEGRADED') return 'warning'
  return 'info'
}
