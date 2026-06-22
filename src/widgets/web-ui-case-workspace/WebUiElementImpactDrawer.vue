<script setup lang="ts">
import { Link } from '@element-plus/icons-vue'

import {
  formatLocatorType,
  formatStepType,
  type WebUiElementReferenceItem,
  type WebUiLocatorType,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

export type ElementImpactReference = WebUiElementReferenceItem & {
  elementId: number
  elementName: string
  elementLocatorType: WebUiLocatorType
  elementLocatorValue: string
}

interface ImpactReferenceStats {
  caseCount: number
  templateCount: number
  unsyncedCount: number
  totalCount: number
}

defineProps<{
  modelValue: boolean
  elementCount: number
  stats: ImpactReferenceStats
  references: ElementImpactReference[]
  loading: boolean
  syncing: boolean
  unsyncedCount: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: [reference: ElementImpactReference]
  sync: []
}>()

function formatReferenceSourceType(type: string) {
  if (type === 'TEMPLATE') return '模板'
  return '用例'
}

function formatReferenceStepType(type: string) {
  return formatStepType(type as WebUiStepType)
}

function isImpactReferenceLocatorSynced(item: ElementImpactReference) {
  return item.locatorType === item.elementLocatorType && item.locatorValue === item.elementLocatorValue
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="引用影响分析"
    size="960px"
    class="web-ui-element-impact-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="web-ui-element-impact">
      <div class="web-ui-element-impact__summary">
        <el-tag type="info" effect="light">元素 {{ elementCount }}</el-tag>
        <el-tag type="success" effect="light">用例引用 {{ stats.caseCount }}</el-tag>
        <el-tag type="warning" effect="light">模板引用 {{ stats.templateCount }}</el-tag>
        <el-tag :type="stats.unsyncedCount ? 'danger' : 'success'" effect="light">
          不同步 {{ stats.unsyncedCount }}
        </el-tag>
      </div>

      <el-alert
        v-if="stats.unsyncedCount > 0"
        type="warning"
        show-icon
        :closable="false"
        title="存在步骤定位器与元素库不一致的引用，修改元素定位器前建议先评估并同步。"
      />

      <el-table
        v-loading="loading"
        :data="references"
        row-key="stepId"
        border
        empty-text="暂无引用影响"
      >
        <el-table-column prop="elementName" label="元素" min-width="150" show-overflow-tooltip />
        <el-table-column label="来源" width="86">
          <template #default="{ row }">
            <el-tag :type="row.sourceType === 'TEMPLATE' ? 'warning' : 'success'" effect="light">
              {{ formatReferenceSourceType(row.sourceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceName" label="用例/模板" min-width="170" show-overflow-tooltip />
        <el-table-column prop="moduleName" label="模块" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.moduleName || '-' }}</template>
        </el-table-column>
        <el-table-column label="步骤" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.sortOrder }}. {{ row.stepName || formatReferenceStepType(row.stepType) }}
          </template>
        </el-table-column>
        <el-table-column label="同步状态" width="104">
          <template #default="{ row }">
            <el-tag :type="isImpactReferenceLocatorSynced(row) ? 'success' : 'danger'" effect="light">
              {{ isImpactReferenceLocatorSynced(row) ? '一致' : '不一致' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="元素定位器" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatLocatorType(row.elementLocatorType) }}：{{ row.elementLocatorValue || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="步骤定位值" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.locatorType ? `${formatLocatorType(row.locatorType)}：${row.locatorValue || '-'}` : row.locatorValue || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <el-button :icon="Link" link type="primary" @click="emit('open', row)">打开</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <div class="web-ui-element-impact__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          type="primary"
          :loading="syncing"
          :disabled="!unsyncedCount"
          @click="emit('sync')"
        >
          同步不同步引用
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-impact {
  display: grid;
  gap: var(--app-space-3);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-impact-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-element-impact__summary,
.web-ui-element-impact__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-impact__summary {
  flex-wrap: wrap;
}

.web-ui-element-impact__footer {
  justify-content: flex-end;
}
</style>
