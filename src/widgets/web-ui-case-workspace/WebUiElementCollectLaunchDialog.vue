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
import type { LocalRunnerHealthView } from '@/entities/web-ui-automation/lib/localRunnerClient'
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
  localRunnerHealth: LocalRunnerHealthView | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'module-change': []
  'page-change': [value: number | null]
  'group-change': [value: number | null]
  'check-local-runner': []
  'open-local-runner-page': []
  start: []
  offline: []
}>()

const runnerState = computed(() => {
  const health = props.localRunnerHealth
  if (props.localRunnerChecking) {
    return {
      tagType: 'info' as const,
      label: '检测中',
      title: '正在检测本地执行器',
      description: '正在读取 Runner、Playwright 和浏览器页面状态。',
    }
  }
  if (!health?.online) {
    return {
      tagType: 'info' as const,
      label: '未连接',
      title: '本地执行器未连接',
      description: '请先在前端项目目录启动 npm run runner，或点击检测刷新状态。',
    }
  }
  if (!health.playwrightAvailable || !health.chromiumInstalled) {
    return {
      tagType: 'warning' as const,
      label: '依赖不可用',
      title: 'Runner 已连接，但 Playwright 或 Chromium 不可用',
      description: '请检查本地 Runner 依赖安装后再采集。',
    }
  }
  if (!health.currentUrl) {
    return {
      tagType: 'warning' as const,
      label: '未打开页面',
      title: 'Runner 已连接，尚未绑定可采集页面',
      description: '可以填写目标页地址后点击“打开目标页”，也可以在 Runner 浏览器里手动进入目标业务页面。',
    }
  }
  return {
    tagType: 'success' as const,
    label: '页面就绪',
    title: 'Runner 页面已就绪',
    description: `将采集当前页面：${health.currentUrl}`,
  }
})

const runnerContextNotice = computed(() => {
  const currentUrl = props.localRunnerHealth?.currentUrl || ''
  if (!currentUrl) {
    return null
  }
  if (isProbablyLoginUrl(currentUrl)) {
    return {
      type: 'warning' as const,
      title: 'Runner 当前页面可能是登录页',
      description: '请先在 Runner 浏览器里完成登录并进入目标业务页面，再开始采集。',
    }
  }
  const expectedUrl = props.form.pageUrl.trim()
  if (expectedUrl && normalizeCollectUrl(currentUrl) !== normalizeCollectUrl(expectedUrl)) {
    return {
      type: 'warning' as const,
      title: 'Runner 当前页和目标页地址不一致',
      description: '采集会以 Runner 当前浏览器页面为准。如果不是目标业务页，请点击“打开目标页”或手动切回目标页。',
    }
  }
  return null
})

function normalizeCollectUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return url.trim().replace(/\/+$/, '')
  }
}

function isProbablyLoginUrl(url: string) {
  return /login|signin|auth|passport|sso/i.test(url)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="760px"
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

      <el-form-item label="本地执行器">
        <div class="web-ui-collect-launch__runner">
            <div class="web-ui-collect-launch__runner-status">
            <el-tag :type="runnerState.tagType" effect="light">
              {{ runnerState.label }}
            </el-tag>
            <strong>{{ runnerState.title }}</strong>
            <span v-if="localRunnerHealth?.runnerVersion">Runner {{ localRunnerHealth.runnerVersion }}</span>
            <span v-if="localRunnerHealth?.online">
              Playwright {{ localRunnerHealth.playwrightAvailable ? '可用' : '不可用' }} /
              Chromium {{ localRunnerHealth.chromiumInstalled ? '已安装' : '未安装' }}
            </span>
            <small>{{ runnerState.description }}</small>
          </div>
          <div class="web-ui-collect-launch__runner-actions">
            <AppButton size="small" :loading="localRunnerChecking" @click="emit('check-local-runner')">
              检测
            </AppButton>
            <AppButton size="small" :loading="localRunnerOpening" @click="emit('open-local-runner-page')">
              打开目标页
            </AppButton>
          </div>
        </div>
      </el-form-item>

      <el-alert
        v-if="runnerContextNotice"
        class="web-ui-collect-launch__context"
        :type="runnerContextNotice.type"
        :title="runnerContextNotice.title"
        :description="runnerContextNotice.description"
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
        <AppButton type="primary" :icon="Cpu" :loading="localRunnerCapturing" @click="emit('start')">
          开始采集
        </AppButton>
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

.web-ui-collect-launch__runner-status small {
  flex-basis: 100%;
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
