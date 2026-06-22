<script setup lang="ts">
import { Link } from '@element-plus/icons-vue'

import {
  formatLocatorType,
  formatStepType,
  type WebUiElementItem,
  type WebUiElementReferenceItem,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

defineProps<{
  modelValue: boolean
  target: WebUiElementItem | null
  references: WebUiElementReferenceItem[]
  loading: boolean
  syncing: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: [reference: WebUiElementReferenceItem]
  sync: []
}>()

function formatReferenceSourceType(type: string) {
  if (type === 'TEMPLATE') return '模板'
  return '用例'
}

function formatReferenceStepType(type: string) {
  return formatStepType(type as WebUiStepType)
}

function isReferenceLocatorSynced(target: WebUiElementItem | null, item: WebUiElementReferenceItem) {
  if (!target) return false
  return item.locatorType === target.locatorType && item.locatorValue === target.locatorValue
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="元素引用"
    size="760px"
    class="web-ui-element-reference-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="web-ui-element-reference">
      <el-alert
        v-if="target"
        type="info"
        show-icon
        :closable="false"
        :title="`${target.elementName}：${formatLocatorType(target.locatorType)} = ${target.locatorValue}`"
      />

      <el-table
        v-loading="loading"
        :data="references"
        row-key="stepId"
        border
        empty-text="暂无引用"
      >
        <el-table-column label="来源" width="86">
          <template #default="{ row }">
            <el-tag :type="row.sourceType === 'TEMPLATE' ? 'warning' : 'success'" effect="light">
              {{ formatReferenceSourceType(row.sourceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceName" label="用例/模板" min-width="160" show-overflow-tooltip />
        <el-table-column prop="moduleName" label="模块" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.moduleName || '-' }}</template>
        </el-table-column>
        <el-table-column label="步骤" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.sortOrder }}. {{ row.stepName || formatReferenceStepType(row.stepType) }}
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ formatReferenceStepType(row.stepType) }}</template>
        </el-table-column>
        <el-table-column label="同步状态" width="104">
          <template #default="{ row }">
            <el-tag :type="isReferenceLocatorSynced(target, row) ? 'success' : 'warning'" effect="light">
              {{ isReferenceLocatorSynced(target, row) ? '一致' : '不一致' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="82">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" effect="light">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="元素定位器" min-width="180" show-overflow-tooltip>
          <template #default>
            {{ target ? `${formatLocatorType(target.locatorType)}：${target.locatorValue}` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="locatorValue" label="步骤定位值" min-width="180" show-overflow-tooltip>
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
      <div class="web-ui-element-reference__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          type="primary"
          :loading="syncing"
          :disabled="!references.length"
          @click="emit('sync')"
        >
          同步到引用步骤
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-reference {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-reference__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}
</style>
