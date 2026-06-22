<script setup lang="ts">
import { type WebUiElementValidateResultItem } from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

type BatchValidateFilter = 'ALL' | 'FAILED'

interface BatchValidateSummary {
  totalCount: number
  passedCount: number
  failedCount: number
}

defineProps<{
  modelValue: boolean
  summary: BatchValidateSummary
  filter: BatchValidateFilter
  results: WebUiElementValidateResultItem[]
  failedCount: number
  operating: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'filter-change': [filter: BatchValidateFilter]
  'preview-screenshot': [result: WebUiElementValidateResultItem]
  focus: [result: WebUiElementValidateResultItem]
  retry: []
}>()

function getValidateFailureHint(result: WebUiElementValidateResultItem) {
  if (result.matched) return ''
  const message = result.errorMessage || ''
  if (message.includes('Timeout') || message.includes('超时')) return '页面加载或元素出现超时，建议检查环境地址、登录态和等待时间。'
  if (message.includes('not found') || message.includes('未找到')) return '未找到匹配元素，建议检查页面是否变化、定位器是否仍唯一有效。'
  if (message.includes('strict mode') || result.matchCount > 1) return '匹配到多个元素，建议改用更精确的 CSS、文本或角色定位。'
  if (message.includes('SyntaxError') || message.includes('selector')) return '定位器语法可能不正确，建议先在浏览器控制台或 Playwright 中验证。'
  return '建议查看截图和目标页面状态，确认元素是否可见、是否需要登录或前置操作。'
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="批量验证结果"
    size="900px"
    class="web-ui-element-batch-validate-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-scrollbar class="web-ui-element-batch-validate-scrollbar">
      <div class="web-ui-element-batch-validate">
        <div class="web-ui-element-batch-validate__summary">
          <el-tag type="info" effect="light">总数 {{ summary.totalCount }}</el-tag>
          <el-tag type="success" effect="light">通过 {{ summary.passedCount }}</el-tag>
          <el-tag type="danger" effect="light">失败 {{ summary.failedCount }}</el-tag>
        </div>

        <div class="web-ui-element-batch-validate__filters">
          <AppButton size="small" :type="filter === 'ALL' ? 'primary' : 'default'" @click="emit('filter-change', 'ALL')">
            全部结果
          </AppButton>
          <AppButton size="small" :type="filter === 'FAILED' ? 'primary' : 'default'" @click="emit('filter-change', 'FAILED')">
            只看失败
          </AppButton>
        </div>

        <el-alert
          v-if="summary.failedCount > 0"
          type="warning"
          show-icon
          :closable="false"
          title="存在验证失败的元素，可查看失败原因、截图证据，或只重试失败项。"
        />
        <el-alert
          v-else-if="filter === 'FAILED'"
          type="success"
          show-icon
          :closable="false"
          title="当前批量验证没有失败项。"
        />

        <el-table
          :data="results"
          row-key="elementId"
          border
          empty-text="暂无批量验证结果"
        >
          <el-table-column label="结果" width="88">
            <template #default="{ row }">
              <el-tag :type="row.matched ? 'success' : 'danger'" effect="light">
                {{ row.matched ? '通过' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="elementName" label="元素名称" min-width="170" show-overflow-tooltip />
          <el-table-column label="匹配数" width="86">
            <template #default="{ row }">{{ row.matchCount }}</template>
          </el-table-column>
          <el-table-column label="失败原因" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
          </el-table-column>
          <el-table-column label="排查建议" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">{{ getValidateFailureHint(row) || '-' }}</template>
          </el-table-column>
          <el-table-column label="截图" width="86">
            <template #default="{ row }">
              <el-button
                v-if="row.screenshotBase64"
                link
                type="primary"
                @click="emit('preview-screenshot', row)"
              >
                查看
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="92" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="emit('focus', row)">定位</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-scrollbar>

    <template #footer>
      <div class="web-ui-element-batch-validate__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          type="primary"
          :loading="operating"
          :disabled="!failedCount"
          @click="emit('retry')"
        >
          重试失败项
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-batch-validate {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-batch-validate-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-element-batch-validate-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-element-batch-validate__summary,
.web-ui-element-batch-validate__filters,
.web-ui-element-batch-validate__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-batch-validate__summary,
.web-ui-element-batch-validate__filters {
  flex-wrap: wrap;
}

.web-ui-element-batch-validate__footer {
  justify-content: flex-end;
}
</style>
