<script setup lang="ts">
import { computed } from 'vue'
import { Cpu, InfoFilled } from '@element-plus/icons-vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import type {
  WebUiElementGroupItem,
  WebUiElementModuleItem,
  WebUiElementPageItem,
  WebUiEnvironmentItem,
} from '@/entities/web-ui-automation'
import {
  buildLocalRunnerStatusView,
  type LocalRunnerAuthStatus,
  type LocalRunnerHealthView,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import type { WebUiElementCollectLaunchForm } from './elementCollectTypes'

const props = defineProps<{
  modelValue: boolean
  form: WebUiElementCollectLaunchForm
  aiProviderLoading: boolean
  availableAiProviders: AiProviderConnectionItem[]
  enabledEnvironments: WebUiEnvironmentItem[]
  modules: WebUiElementModuleItem[]
  pageOptions: WebUiElementPageItem[]
  groupOptions: WebUiElementGroupItem[]
  localRunnerChecking: boolean
  localRunnerOpening: boolean
  localRunnerCapturing: boolean
  localRunnerAuthSaving: boolean
  localRunnerAuthClearing: boolean
  localRunnerSessionReleasing: boolean
  localRunnerHealth: LocalRunnerHealthView | null
  localRunnerAuthStatus: LocalRunnerAuthStatus | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'module-change': []
  'page-change': [value: number | null]
  'group-change': [value: number | null]
  'check-local-runner': []
  'open-local-runner-page': []
  'save-local-runner-auth': []
  'clear-local-runner-auth': []
  'release-local-runner-session': []
  start: []
  offline: []
}>()

const runnerState = computed(() => buildLocalRunnerStatusView({
  checking: props.localRunnerChecking,
  health: props.localRunnerHealth,
  expectedUrl: props.form.pageUrl,
}))

const canStartCollect = computed(() => runnerState.value.canCollect && !props.localRunnerCapturing)
const canManageAuth = computed(() => Boolean(props.localRunnerHealth?.online))
const canReleaseSession = computed(() => Boolean(props.localRunnerHealth?.online && props.localRunnerHealth.currentUrl))

const authStateTag = computed(() => {
  if (!props.localRunnerHealth?.online) {
    return null
  }
  if (!props.localRunnerAuthStatus) {
    return {
      type: props.localRunnerHealth.authStateExists ? 'success' : 'info',
      text: props.localRunnerHealth.authStateExists ? '已保存登录态' : '未保存登录态',
    } as const
  }
  if (!props.localRunnerAuthStatus.exists) {
    return {
      type: 'info',
      text: '未保存登录态',
    } as const
  }
  return {
    type: props.localRunnerAuthStatus.stale ? 'warning' : 'success',
    text: props.localRunnerAuthStatus.stale ? '登录态建议刷新' : '已保存登录态',
  } as const
})

const authStatusDescription = computed(() => {
  const status = props.localRunnerAuthStatus
  if (!props.localRunnerHealth?.online) {
    return ''
  }
  if (!props.form.environmentId) {
    return '未选择运行环境时，会使用 Runner 默认环境保存或复用登录态。'
  }
  if (!status) {
    return '检测 Runner 后会显示当前环境的登录态快照状态。'
  }
  if (!status.exists) {
    return '当前环境还没有保存登录态。需要登录的页面，请先打开目标页并手动登录，再点击“保存登录态”。'
  }
  const savedAt = formatDateTime(status.savedAt)
  const age = formatAge(status.ageMinutes)
  const staleText = status.stale ? '，保存时间较久，建议重新登录后保存一次' : ''
  return `保存于 ${savedAt}${age ? `，约 ${age}` : ''}${staleText}。`
})

const authSavedUrl = computed(() => props.localRunnerAuthStatus?.savedUrl || '')

const sessionStateTag = computed(() => {
  if (!props.localRunnerHealth?.online || !props.localRunnerHealth.currentUrl) {
    return null
  }
  if (props.localRunnerHealth.expired) {
    return {
      type: 'danger',
      text: '页面会话已过期',
    } as const
  }
  const remainingSeconds = props.localRunnerHealth.remainingSeconds
  if (typeof remainingSeconds === 'number' && remainingSeconds <= 120) {
    return {
      type: 'warning',
      text: '页面会话即将过期',
    } as const
  }
  return {
    type: 'success',
    text: '页面会话有效',
  } as const
})

const sessionStatusDescription = computed(() => {
  const health = props.localRunnerHealth
  if (!health?.online || !health.currentUrl) {
    return ''
  }
  if (health.expired) {
    return '当前 Runner 页面会话已过期，请释放后重新打开目标页。'
  }
  const remaining = formatRemaining(health.remainingSeconds)
  const ttlText = health.ttlMinutes ? `，TTL ${health.ttlMinutes} 分钟` : ''
  return remaining ? `当前页面会话剩余 ${remaining}${ttlText}。` : `当前页面会话已创建${ttlText}。`
})

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAge(value?: number | null) {
  if (typeof value !== 'number') {
    return ''
  }
  if (value < 60) {
    return `${value} 分钟前`
  }
  if (value < 24 * 60) {
    return `${Math.floor(value / 60)} 小时前`
  }
  return `${Math.floor(value / 1440)} 天前`
}

function formatRemaining(value?: number | null) {
  if (typeof value !== 'number') {
    return ''
  }
  if (value <= 0) {
    return '0 分钟'
  }
  if (value < 60) {
    return `${value} 秒`
  }
  return `${Math.ceil(value / 60)} 分钟`
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="780px"
    class="web-ui-collect-launch"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="web-ui-collect-launch__title">
        <span>新建 AI 采集任务</span>
        <el-tooltip
          content="入口只负责创建采集任务；候选审核、过滤明细、重新验证和保存会进入独立采集工作台处理。"
          placement="bottom-start"
        >
          <el-icon><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
    </template>

    <el-form class="web-ui-collect-launch__form" label-width="112px">
      <el-form-item label="AI 采集模型" required>
        <el-select
          v-model="form.providerConnectionId"
          :loading="aiProviderLoading"
          clearable
          filterable
          placeholder="选择连接池中已配置模型的 AI 连接"
        >
          <el-option
            v-for="item in availableAiProviders"
            :key="item.id"
            :label="`${item.connectionName} / ${item.modelName || '-'}`"
            :value="item.id"
          >
            <div class="web-ui-collect-launch__provider-option">
              <span>{{ item.connectionName }} / {{ item.modelName || '-' }}</span>
              <small>{{ item.protocolType }}</small>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="运行环境">
        <el-select v-model="form.environmentId" clearable filterable placeholder="选择登录态或运行环境">
          <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="目标页地址">
        <el-input v-model="form.pageUrl" clearable placeholder="可选：用于让本地 Runner 打开页面，例如 https://example.com/orders" />
      </el-form-item>

      <el-form-item label="本地 Runner">
        <div class="web-ui-collect-launch__runner">
          <div class="web-ui-collect-launch__runner-status">
            <el-tag :type="runnerState.tagType" effect="light">
              {{ runnerState.label }}
            </el-tag>
            <strong>{{ runnerState.title }}</strong>
            <span v-if="runnerState.runnerVersion">Runner {{ runnerState.runnerVersion }}</span>
            <span v-if="localRunnerHealth?.online">
              Playwright {{ localRunnerHealth.playwrightAvailable ? '可用' : '不可用' }} /
              Chromium {{ localRunnerHealth.chromiumInstalled ? '已安装' : '未安装' }}
            </span>
            <el-tag
              v-if="authStateTag"
              :type="authStateTag.type"
              effect="plain"
            >
              {{ authStateTag.text }}
            </el-tag>
            <el-tag
              v-if="sessionStateTag"
              :type="sessionStateTag.type"
              effect="plain"
            >
              {{ sessionStateTag.text }}
            </el-tag>
            <small>{{ runnerState.description }}</small>
            <div v-if="runnerState.currentUrl" class="web-ui-collect-launch__current-url">
              当前页面：{{ runnerState.currentUrl }}
            </div>
            <div v-if="sessionStatusDescription" class="web-ui-collect-launch__session-status">
              {{ sessionStatusDescription }}
            </div>
            <div v-if="localRunnerHealth?.online" class="web-ui-collect-launch__auth-status">
              <span>{{ authStatusDescription }}</span>
              <span v-if="authSavedUrl">保存页面：{{ authSavedUrl }}</span>
            </div>
            <div v-if="runnerState.commands.length" class="web-ui-collect-launch__commands">
              <span>处理命令：</span>
              <code v-for="command in runnerState.commands" :key="command">{{ command }}</code>
            </div>
          </div>
          <div class="web-ui-collect-launch__runner-actions">
            <AppButton size="small" :loading="localRunnerChecking" @click="emit('check-local-runner')">
              检测
            </AppButton>
            <AppButton
              size="small"
              :loading="localRunnerOpening"
              :disabled="!runnerState.canOpenPage && runnerState.kind !== 'OFFLINE'"
              @click="emit('open-local-runner-page')"
            >
              打开目标页
            </AppButton>
            <AppButton
              size="small"
              :loading="localRunnerAuthSaving"
              :disabled="!canManageAuth"
              @click="emit('save-local-runner-auth')"
            >
              保存登录态
            </AppButton>
            <AppButton
              size="small"
              :loading="localRunnerAuthClearing"
              :disabled="!canManageAuth"
              @click="emit('clear-local-runner-auth')"
            >
              清空登录态
            </AppButton>
            <AppButton
              size="small"
              :loading="localRunnerSessionReleasing"
              :disabled="!canReleaseSession"
              @click="emit('release-local-runner-session')"
            >
              释放页面会话
            </AppButton>
          </div>
        </div>
      </el-form-item>

      <el-alert
        v-if="runnerState.kind !== 'READY'"
        class="web-ui-collect-launch__context"
        :type="runnerState.alertType"
        :title="runnerState.title"
        :description="runnerState.description"
        show-icon
        :closable="false"
      />

      <el-form-item label="所属模块" required>
        <el-select
          v-model="form.moduleId"
          clearable
          filterable
          placeholder="选择模块"
          @change="emit('module-change')"
        >
          <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="页面对象" required>
        <div class="web-ui-collect-launch__page-target">
          <el-select
            v-model="form.pageId"
            clearable
            filterable
            placeholder="选择已有页面对象"
            @change="emit('page-change', $event as number | null)"
          >
            <el-option v-for="item in pageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
          </el-select>
          <el-input v-model="form.pageName" clearable placeholder="或填写新页面对象名称" />
        </div>
      </el-form-item>

      <el-form-item label="分组策略">
        <el-radio-group v-model="form.groupStrategy">
          <el-radio-button value="AI">AI 建议分组</el-radio-button>
          <el-radio-button value="CUSTOM">自选分组</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.groupStrategy === 'CUSTOM'" label="自选分组" required>
        <div class="web-ui-collect-launch__group-target">
          <el-select
            v-model="form.groupId"
            clearable
            filterable
            placeholder="选择已有分组"
            :disabled="!form.pageId"
            @change="emit('group-change', $event as number | null)"
          >
            <el-option v-for="item in groupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
          </el-select>
          <el-input v-model="form.groupName" clearable placeholder="或填写新分组名称" />
        </div>
      </el-form-item>

      <el-form-item label="采集范围">
        <el-radio-group v-model="form.scope">
          <el-radio-button value="ALL">全部</el-radio-button>
          <el-radio-button value="FORM">表单</el-radio-button>
          <el-radio-button value="BUTTON">按钮</el-radio-button>
          <el-radio-button value="TABLE">表格</el-radio-button>
          <el-radio-button value="DIALOG">弹窗</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="web-ui-collect-launch__footer">
        <AppButton @click="emit('offline')">离线 HTML 导入</AppButton>
        <span class="web-ui-collect-launch__hint">候选审核会在采集工作台中完成</span>
        <AppButton @click="emit('update:modelValue', false)">取消</AppButton>
        <el-tooltip
          :disabled="canStartCollect"
          content="请先启动 Runner，并在 Runner 浏览器中进入可采集的目标业务页面。"
          placement="top"
        >
          <span>
            <AppButton
              type="primary"
              :icon="Cpu"
              :loading="localRunnerCapturing"
              :disabled="!canStartCollect"
              @click="emit('start')"
            >
              开始采集
            </AppButton>
          </span>
        </el-tooltip>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.web-ui-collect-launch__title {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  font-weight: 600;
}

.web-ui-collect-launch__title .el-icon {
  color: var(--app-text-muted);
  cursor: help;
}

.web-ui-collect-launch__form {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-collect-launch__provider-option,
.web-ui-collect-launch__footer,
.web-ui-collect-launch__runner-status,
.web-ui-collect-launch__runner-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-collect-launch__provider-option {
  justify-content: space-between;
}

.web-ui-collect-launch__provider-option small,
.web-ui-collect-launch__hint,
.web-ui-collect-launch__runner-status,
.web-ui-collect-launch__runner-status small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-launch__runner {
  display: grid;
  gap: var(--app-space-3);
  width: 100%;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.web-ui-collect-launch__runner-status small,
.web-ui-collect-launch__current-url,
.web-ui-collect-launch__session-status,
.web-ui-collect-launch__auth-status,
.web-ui-collect-launch__commands {
  flex-basis: 100%;
}

.web-ui-collect-launch__current-url,
.web-ui-collect-launch__session-status,
.web-ui-collect-launch__auth-status {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-launch__auth-status {
  display: grid;
  gap: 2px;
}

.web-ui-collect-launch__commands {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-collect-launch__commands code {
  display: block;
  padding: 6px 8px;
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xs);
  white-space: normal;
  word-break: break-all;
}

.web-ui-collect-launch__page-target,
.web-ui-collect-launch__group-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--app-space-3);
  width: 100%;
}

.web-ui-collect-launch__footer {
  justify-content: flex-end;
}

.web-ui-collect-launch__hint {
  margin-right: auto;
}

.web-ui-collect-launch :deep(.el-select) {
  width: 100%;
}

@media (max-width: 700px) {
  .web-ui-collect-launch__page-target,
  .web-ui-collect-launch__group-target {
    grid-template-columns: 1fr;
  }
}
</style>
