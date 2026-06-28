<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshRight, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { ConfigStatCard, ConfigTypeBadge, type ConfigStat } from '@/entities/config'
import { localRunnerApi, type RunnerNodeSummary } from '@/entities/local-runner'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const runners = ref<RunnerNodeSummary[]>([])
const loading = ref(false)
const scanning = ref(false)
const errorMessage = ref('')

const stats = computed<ConfigStat[]>(() => {
  const onlineCount = runners.value.filter(item => !item.offline).length
  const offlineCount = runners.value.filter(item => item.offline).length
  const availableSlots = runners.value.reduce((total, item) => total + numberFromRecord(item.resource, 'availableSlots'), 0)
  const usedSlots = runners.value.reduce((total, item) => total + numberFromRecord(item.resource, 'usedSlots'), 0)

  return [
    { label: '执行器总数', value: runners.value.length, tone: 'primary' },
    { label: '在线节点', value: onlineCount, tone: 'success' },
    { label: '离线节点', value: offlineCount, tone: offlineCount > 0 ? 'danger' : 'default' },
    { label: '占用槽位', value: `${usedSlots}/${usedSlots + availableSlots}`, tone: 'warning' },
  ]
})

async function loadRunners() {
  loading.value = true
  errorMessage.value = ''
  try {
    runners.value = await localRunnerApi.getRunnerNodes()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function triggerOfflineScan() {
  scanning.value = true
  try {
    const result = await localRunnerApi.triggerOfflineScan()
    ElMessage.success(result.changedTasks > 0 ? `已处理 ${result.changedTasks} 个离线任务` : '未发现需要处理的离线任务')
    await loadRunners()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scanning.value = false
  }
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function textFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function formatHeartbeat(seconds: number | null) {
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

function formatRunnerName(item: RunnerNodeSummary) {
  return item.runnerName || item.runnerId
}

function getRunnerStatusLabel(item: RunnerNodeSummary) {
  if (item.offline) {
    return '离线'
  }
  if (item.status === 'ONLINE') {
    return '在线'
  }
  return item.status || '未知'
}

function getRunnerStatusTone(item: RunnerNodeSummary) {
  if (item.offline) {
    return 'danger'
  }
  if (item.status === 'ONLINE') {
    return 'success'
  }
  return 'warning'
}

function getCapabilityText(item: RunnerNodeSummary) {
  return item.capabilities?.length ? item.capabilities.join(' / ') : '未上报能力'
}

function getBrowserText(item: RunnerNodeSummary) {
  return textFromRecord(item.browser, 'chromium') || textFromRecord(item.browser, 'browser') || '未上报'
}

function getSessionText(item: RunnerNodeSummary) {
  return textFromRecord(item.session, 'activePageUrl') || textFromRecord(item.session, 'status') || '暂无会话'
}

onMounted(() => {
  void loadRunners()
})
</script>

<template>
  <section class="config-runner-panel">
    <header class="config-runner-panel__header">
      <div>
        <h2>本地执行器</h2>
        <p>查看 Local Runner 在线状态、能力标签、资源槽位和最近心跳。</p>
      </div>
      <div class="config-runner-panel__actions">
        <AppButton :icon="Warning" :loading="scanning" @click="triggerOfflineScan">离线扫描</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadRunners">刷新</AppButton>
      </div>
    </header>

    <div class="config-runner-panel__stats">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <div v-if="errorMessage && runners.length" class="config-runner-panel__inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadRunners">重试</AppButton>
    </div>

    <AppLoadingState v-if="loading && !runners.length" text="正在加载本地执行器..." />

    <AppEmptyState
      v-else-if="errorMessage && !runners.length"
      title="执行器状态加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadRunners">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="runners.length" class="config-runner-table-card">
      <table>
        <colgroup>
          <col class="config-runner-table-card__name-col" />
          <col class="config-runner-table-card__status-col" />
          <col class="config-runner-table-card__resource-col" />
          <col class="config-runner-table-card__capability-col" />
          <col class="config-runner-table-card__runtime-col" />
          <col class="config-runner-table-card__heartbeat-col" />
        </colgroup>
        <thead>
          <tr>
            <th>执行器</th>
            <th>状态</th>
            <th>资源槽位</th>
            <th>能力标签</th>
            <th>运行环境</th>
            <th>最近心跳</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in runners" :key="item.runnerId" :class="{ 'is-offline': item.offline }">
            <td>
              <div class="config-runner-title">{{ formatRunnerName(item) }}</div>
              <span class="config-runner-subtitle">{{ item.runnerId }}</span>
              <span class="config-runner-subtitle">Runner {{ item.runnerVersion || '-' }} / 协议 {{ item.protocolVersion || '-' }}</span>
            </td>
            <td>
              <ConfigTypeBadge
                :label="getRunnerStatusLabel(item)"
                :tone="getRunnerStatusTone(item)"
              />
            </td>
            <td>
              <div class="config-runner-resource">
                <strong>{{ numberFromRecord(item.resource, 'usedSlots') }} / {{ numberFromRecord(item.resource, 'maxSlots') }}</strong>
                <span>可用 {{ numberFromRecord(item.resource, 'availableSlots') }}</span>
              </div>
            </td>
            <td>
              <span class="config-runner-muted" :title="getCapabilityText(item)">
                {{ getCapabilityText(item) }}
              </span>
            </td>
            <td>
              <div class="config-runner-runtime">
                <span>{{ getBrowserText(item) }}</span>
                <code :title="getSessionText(item)">{{ getSessionText(item) }}</code>
              </div>
            </td>
            <td>
              <span class="config-runner-muted">{{ formatHeartbeat(item.secondsSinceHeartbeat) }}</span>
              <span class="config-runner-subtitle">{{ item.lastHeartbeatAt || '-' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppEmptyState
      v-else
      title="暂无本地执行器"
      description="启动 Web UI Runner 后，它会自动注册并上报心跳。"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadRunners">刷新状态</AppButton>
      </template>
    </AppEmptyState>
  </section>
</template>

<style scoped>
.config-runner-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-runner-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-runner-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.config-runner-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.config-runner-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-runner-panel__stats {
  display: grid;
  gap: var(--app-space-4);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.config-runner-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.config-runner-table-card {
  overflow: hidden;
  min-height: 120px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-runner-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-runner-table-card__name-col {
  width: 22%;
}

.config-runner-table-card__status-col {
  width: 88px;
}

.config-runner-table-card__resource-col {
  width: 120px;
}

.config-runner-table-card__capability-col {
  width: 20%;
}

.config-runner-table-card__runtime-col {
  width: 24%;
}

.config-runner-table-card__heartbeat-col {
  width: 150px;
}

.config-runner-table-card thead {
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-page);
}

.config-runner-table-card th {
  padding: var(--app-space-3) var(--app-space-5);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  text-align: left;
}

.config-runner-table-card td {
  padding: var(--app-space-4) var(--app-space-5);
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  vertical-align: middle;
}

.config-runner-table-card tr:last-child td {
  border-bottom: 0;
}

.config-runner-table-card tr.is-offline {
  background: var(--app-danger-soft);
}

.config-runner-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-subtitle,
.config-runner-muted {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-resource,
.config-runner-runtime {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.config-runner-resource strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.config-runner-resource span,
.config-runner-runtime span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-runtime code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .config-runner-panel__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .config-runner-panel__header {
    flex-direction: column;
  }

  .config-runner-panel__actions {
    justify-content: flex-start;
  }

  .config-runner-table-card {
    overflow-x: auto;
  }

  .config-runner-table-card table {
    min-width: 1040px;
  }
}

@media (max-width: 720px) {
  .config-runner-panel__stats {
    grid-template-columns: 1fr;
  }
}
</style>
