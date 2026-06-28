import type { RunnerNodeSummary } from '../model/types'

export function isRunnerOnline(runner: RunnerNodeSummary) {
  return !runner.offline && runner.status !== 'OFFLINE'
}

export function runnerSupportsTask(runner: RunnerNodeSummary, taskType: string) {
  if (!taskType) {
    return true
  }
  if (!runner.capabilities?.length) {
    return true
  }
  return runner.capabilities.some(capability => capability.toUpperCase() === taskType.toUpperCase())
}

export function isRunnerSelectable(runner: RunnerNodeSummary, taskType: string) {
  return isRunnerOnline(runner) && runnerSupportsTask(runner, taskType)
}

export function selectDefaultRunnerId(runners: RunnerNodeSummary[], currentRunnerId: string | null, taskType: string) {
  if (currentRunnerId && runners.some(runner => runner.runnerId === currentRunnerId && isRunnerSelectable(runner, taskType))) {
    return currentRunnerId
  }
  return runners.find(runner => isRunnerSelectable(runner, taskType))?.runnerId || null
}

export function runnerDisplayName(runner: RunnerNodeSummary) {
  return runner.runnerName || runner.runnerId
}

export function runnerOptionLabel(runner: RunnerNodeSummary, taskType: string) {
  const status = isRunnerOnline(runner) ? '在线' : '离线'
  const taskCount = Array.isArray(runner.activeTasks) ? runner.activeTasks.length : 0
  const capability = runnerSupportsTask(runner, taskType) ? taskType : '能力不匹配'
  return `${runnerDisplayName(runner)} · ${status} · ${capability} · ${taskCount} 个任务`
}

export function runnerStatusText(runner: RunnerNodeSummary) {
  if (!isRunnerOnline(runner)) {
    return '离线'
  }
  if (runner.status === 'ONLINE') {
    return '在线'
  }
  return runner.status || '未知'
}

export function runnerHeartbeatText(runner: RunnerNodeSummary) {
  const seconds = runner.secondsSinceHeartbeat
  if (seconds == null) {
    return '从未上报'
  }
  if (seconds < 60) {
    return `${seconds} 秒前`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟前`
  }
  return `${Math.floor(seconds / 3600)} 小时前`
}

export function runnerActiveTaskText(runner: RunnerNodeSummary) {
  const taskCount = Array.isArray(runner.activeTasks) ? runner.activeTasks.length : 0
  return `${taskCount} 个任务`
}

