<script setup lang="ts">
import { computed } from 'vue'
import { Camera } from '@element-plus/icons-vue'

import {
  formatWebUiDateTime,
  type WebUiElementCollectTaskResponse,
  type WebUiElementItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  task: WebUiElementCollectTaskResponse
  moduleItem: WebUiElementModuleItem | null
  pageItem: WebUiElementPageItem | null
  routePageName: string
  routePageUrl: string
  groupStrategy: string
  routeGroupName: string
  savedElements: WebUiElementItem[]
  savedElementsLoading: boolean
}>()

const emit = defineEmits<{
  'preview-global-screenshot': []
  'open-element': [element: WebUiElementItem]
}>()

const pageObjectName = computed(() =>
  props.pageItem?.pageName
    || props.routePageName
    || props.task.pageTitle
    || '-',
)

const summaryItems = computed(() => [
  {
    label: '原始候选',
    value: props.task.rawCount,
    type: 'info' as const,
  },
  {
    label: '最终候选',
    value: props.task.finalCount,
    type: 'success' as const,
  },
  {
    label: '空定位',
    value: props.task.filterSummary?.emptyLocatorCount || 0,
    type: 'warning' as const,
  },
  {
    label: '重复定位',
    value: props.task.filterSummary?.duplicateCount || 0,
    type: 'warning' as const,
  },
  {
    label: '低稳定性',
    value: props.task.filterSummary?.lowStabilityCount || 0,
    type: 'danger' as const,
  },
])

const detailGroups = computed(() => [
  {
    title: '任务档案',
    items: [
      { label: '任务 ID', value: `#${props.task.taskId}` },
      { label: '任务状态', value: props.task.status || '-' },
      { label: '当前阶段', value: props.task.currentStage || '-' },
      { label: '进度', value: `${props.task.progressPercent || 0}%` },
      { label: '采集来源', value: props.task.source || '-' },
    ],
  },
  {
    title: '页面信息',
    items: [
      { label: '所属模块', value: props.moduleItem?.moduleName || '-' },
      { label: '页面对象', value: pageObjectName.value },
      { label: '目标地址', value: props.routePageUrl || '-' },
      { label: '实际页面', value: props.task.actualUrl || '-' },
      { label: '页面标题', value: props.task.pageTitle || '-' },
      { label: '分组策略', value: props.groupStrategy === 'CUSTOM' ? `固定分组：${props.routeGroupName || '-'}` : 'AI 建议分组' },
    ],
  },
  {
    title: 'Runner 与 AI',
    items: [
      { label: 'Runner ID', value: props.task.runnerId || '-' },
      { label: '会话 ID', value: props.task.sessionId || '-' },
      { label: 'AI 模型', value: props.task.aiModelName || '-' },
      { label: 'AI 配置 ID', value: props.task.aiModelConfigId ? String(props.task.aiModelConfigId) : '-' },
      { label: '任务说明', value: props.task.message || '-' },
    ],
  },
  {
    title: '时间线',
    items: [
      { label: '创建时间', value: formatWebUiDateTime(props.task.createdAt) },
      { label: '完成时间', value: formatWebUiDateTime(props.task.completedAt) },
    ],
  },
])
</script>

<template>
  <section class="web-ui-collect-trace">
    <div class="web-ui-collect-trace__header">
      <div>
        <strong>任务追溯</strong>
        <p>记录本次采集从哪个页面、哪个 Runner 会话、哪些规则和 AI 处理结果生成。</p>
      </div>
      <AppButton
        size="small"
        :icon="Camera"
        :disabled="!task.globalScreenshotBase64"
        @click="emit('preview-global-screenshot')"
      >
        查看全局截图
      </AppButton>
    </div>

    <div class="web-ui-collect-trace__summary">
      <el-tag
        v-for="item in summaryItems"
        :key="item.label"
        :type="item.type"
        effect="light"
      >
        {{ item.label }} {{ item.value }}
      </el-tag>
    </div>

    <section class="web-ui-collect-trace__section web-ui-collect-trace__section--wide">
      <div class="web-ui-collect-trace__section-header">
        <h3>已入库元素</h3>
        <el-tag type="success" effect="light">{{ savedElements.length }} 个</el-tag>
      </div>
      <el-skeleton v-if="savedElementsLoading" :rows="3" animated />
      <div v-else-if="savedElements.length" class="web-ui-collect-trace__saved-list">
        <button
          v-for="element in savedElements"
          :key="element.id"
          class="web-ui-collect-trace__saved-item"
          type="button"
          @click="emit('open-element', element)"
        >
          <strong>{{ element.elementName }}</strong>
          <span>{{ element.pageName }} / {{ element.groupName || '-' }}</span>
          <small>{{ element.locatorType }}: {{ element.locatorValue }}</small>
        </button>
      </div>
      <p v-else class="web-ui-collect-trace__empty">本次采集任务还没有保存到元素库的元素。</p>
    </section>

    <div class="web-ui-collect-trace__grid">
      <section
        v-for="group in detailGroups"
        :key="group.title"
        class="web-ui-collect-trace__section"
      >
        <h3>{{ group.title }}</h3>
        <dl>
          <template v-for="item in group.items" :key="`${group.title}-${item.label}`">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </section>
</template>

<style scoped>
.web-ui-collect-trace {
  display: grid;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-card);
}

.web-ui-collect-trace__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.web-ui-collect-trace__header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
}

.web-ui-collect-trace__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-trace__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-collect-trace__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--app-space-3);
}

.web-ui-collect-trace__section {
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-soft);
}

.web-ui-collect-trace__section--wide {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-trace__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.web-ui-collect-trace__section h3 {
  margin: 0 0 var(--app-space-3);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-base);
}

.web-ui-collect-trace__section-header h3 {
  margin: 0;
}

.web-ui-collect-trace__saved-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--app-space-2);
}

.web-ui-collect-trace__saved-item {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.web-ui-collect-trace__saved-item:hover {
  border-color: var(--el-color-primary);
}

.web-ui-collect-trace__saved-item strong,
.web-ui-collect-trace__saved-item span,
.web-ui-collect-trace__saved-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-trace__saved-item span,
.web-ui-collect-trace__saved-item small,
.web-ui-collect-trace__empty {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-trace__section dl {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: var(--app-space-2) var(--app-space-3);
  margin: 0;
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-trace__section dt {
  color: var(--app-text-muted);
}

.web-ui-collect-trace__section dd {
  min-width: 0;
  margin: 0;
  color: var(--app-text-primary);
  word-break: break-all;
}
</style>
