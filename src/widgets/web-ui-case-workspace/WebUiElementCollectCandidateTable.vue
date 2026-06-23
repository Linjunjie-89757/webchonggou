<script setup lang="ts">
import {
  WEB_UI_LOCATOR_OPTIONS,
  type WebUiElementCollectCandidate,
} from '@/entities/web-ui-automation'
import {
  getCollectCandidateReviewLevel,
  getCollectCandidateReviewMessage,
  isCollectCandidateSaveable,
} from '@/entities/web-ui-automation/lib/collectTask'
import type { WebUiElementCollectCandidateView } from './elementCollectTypes'

defineProps<{
  candidates: WebUiElementCollectCandidateView[]
}>()

const emit = defineEmits<{
  'preview-screenshot': [candidate: WebUiElementCollectCandidateView]
}>()

function formatValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 建议未验证'
  if (status === 'UNVERIFIED') return '未真机验证'
  if (status === 'PASSED') return '验证通过'
  if (status === 'FAILED') return '未找到'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '未验证'
  return status || '未验证'
}

function getValidationTagType(status?: string | null) {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'MULTIPLE' || status === 'AI_UNVERIFIED' || status === 'UNVERIFIED') return 'warning'
  return 'info'
}

function formatElementType(type?: string | null) {
  if (type === 'FORM') return '表单'
  if (type === 'BUTTON') return '按钮'
  if (type === 'TABLE') return '表格'
  if (type === 'DIALOG') return '弹窗'
  return type || '-'
}

function formatCandidateSource(source?: string | null) {
  if (source === 'AI_SUPPLEMENT') return 'AI 补充'
  if (source === 'STATIC_RULE') return '静态规则'
  return '规则候选'
}

function getCandidateSourceTagType(source?: string | null) {
  return source === 'AI_SUPPLEMENT' ? 'warning' : 'info'
}

function isAiMetadataEnhanced(row: WebUiElementCollectCandidate) {
  return row.candidateSource !== 'AI_SUPPLEMENT'
    && Boolean(row.businessMeaning || row.maintenanceSuggestion || row.stabilityNote)
}

function getCandidateRowClassName({ row }: { row: WebUiElementCollectCandidateView }) {
  const level = getCollectCandidateReviewLevel(row)
  if (level === 'danger') return 'web-ui-collect-candidate-table__row--danger'
  if (level === 'warning') return 'web-ui-collect-candidate-table__row--warning'
  return ''
}

function hasValidationEvidenceState(row: WebUiElementCollectCandidateView) {
  return row.validationStatus === 'PASSED'
    || row.validationStatus === 'FAILED'
    || row.validationStatus === 'MULTIPLE'
}
</script>

<template>
  <el-table
    :data="candidates"
    row-key="id"
    border
    class="web-ui-collect-candidate-table"
    :row-class-name="getCandidateRowClassName"
    empty-text="当前筛选下暂无候选元素"
  >
    <el-table-column label="选择" width="72" align="center" fixed="left">
      <template #default="{ row }">
        <el-checkbox v-model="row.selected" :disabled="!isCollectCandidateSaveable(row)" />
      </template>
    </el-table-column>
    <el-table-column label="来源" width="122">
      <template #default="{ row }">
        <div class="web-ui-collect-candidate-table__tags">
          <el-tag :type="getCandidateSourceTagType(row.candidateSource)" effect="light">
            {{ formatCandidateSource(row.candidateSource) }}
          </el-tag>
          <el-tag v-if="isAiMetadataEnhanced(row)" type="success" effect="light">
            AI 增强
          </el-tag>
        </div>
        <small v-if="row.saveBlockedReason" class="web-ui-collect-candidate-table__hint web-ui-collect-candidate-table__hint--danger">
          {{ row.saveBlockedReason }}
        </small>
      </template>
    </el-table-column>
    <el-table-column label="推荐" width="112">
      <template #default="{ row }">
        <el-tag :type="row.recommendedToSave ? 'success' : 'info'" effect="light">
          {{ row.recommendedToSave ? '建议保存' : '谨慎保存' }}
        </el-tag>
        <small v-if="row.notRecommendedReason" class="web-ui-collect-candidate-table__hint">
          {{ row.notRecommendedReason }}
        </small>
      </template>
    </el-table-column>
    <el-table-column label="建议分组" min-width="150">
      <template #default="{ row }">
        <el-input v-model="row.groupName" class="web-ui-collect-candidate-table__editable" maxlength="80" />
      </template>
    </el-table-column>
    <el-table-column label="元素名称" min-width="180">
      <template #default="{ row }">
        <el-input v-model="row.elementName" class="web-ui-collect-candidate-table__editable" maxlength="80" />
      </template>
    </el-table-column>
    <el-table-column label="定位方式" width="136">
      <template #default="{ row }">
        <el-select v-model="row.locatorType" class="web-ui-collect-candidate-table__editable">
          <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column label="推荐定位器" min-width="260">
      <template #default="{ row }">
        <el-input v-model="row.locatorValue" class="web-ui-collect-candidate-table__editable" maxlength="1000" />
      </template>
    </el-table-column>
    <el-table-column label="验证" min-width="176">
      <template #default="{ row }">
        <el-tag :type="getValidationTagType(row.validationStatus)" effect="light">
          {{ formatValidationStatus(row.validationStatus) }}
        </el-tag>
        <small
          class="web-ui-collect-candidate-table__hint"
          :class="`web-ui-collect-candidate-table__hint--${getCollectCandidateReviewLevel(row)}`"
        >
          {{ getCollectCandidateReviewMessage(row) }}
        </small>
        <el-button
          v-if="row.screenshotBase64"
          link
          :type="getCollectCandidateReviewLevel(row) === 'danger' ? 'danger' : 'primary'"
          class="web-ui-collect-candidate-table__evidence-link"
          @click="emit('preview-screenshot', row)"
        >
          查看截图证据
        </el-button>
        <small
          v-else-if="hasValidationEvidenceState(row)"
          class="web-ui-collect-candidate-table__hint web-ui-collect-candidate-table__evidence-empty"
        >
          暂无截图证据
        </small>
      </template>
    </el-table-column>
    <el-table-column label="类型" width="104">
      <template #default="{ row }">
        <span>{{ formatElementType(row.elementType) }}</span>
        <small class="web-ui-collect-candidate-table__hint">{{ row.tagName || '-' }}</small>
      </template>
    </el-table-column>
    <el-table-column label="稳定性" width="112">
      <template #default="{ row }">
        <el-progress :percentage="row.confidence" :stroke-width="8" :show-text="false" />
        <small class="web-ui-collect-candidate-table__score">{{ row.confidence }}%</small>
      </template>
    </el-table-column>
    <el-table-column label="业务含义" min-width="180" show-overflow-tooltip>
      <template #default="{ row }">
        <span>{{ row.businessMeaning || row.text || row.placeholder || '-' }}</span>
        <small v-if="row.stabilityNote" class="web-ui-collect-candidate-table__hint">{{ row.stabilityNote }}</small>
      </template>
    </el-table-column>
    <el-table-column prop="maintenanceSuggestion" label="维护建议" min-width="190" show-overflow-tooltip />
    <el-table-column prop="reason" label="原因" min-width="190" show-overflow-tooltip />
  </el-table>
</template>

<style scoped>
.web-ui-collect-candidate-table {
  width: 100%;
}

.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__row--danger) {
  --el-table-tr-bg-color: var(--el-color-danger-light-9);
}

.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__row--warning) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

.web-ui-collect-candidate-table__tags {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  flex-wrap: wrap;
}

.web-ui-collect-candidate-table__score,
.web-ui-collect-candidate-table__hint {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.4;
}

.web-ui-collect-candidate-table__score {
  text-align: center;
}

.web-ui-collect-candidate-table__evidence-link {
  margin-top: var(--app-space-1);
  padding: 0;
}

.web-ui-collect-candidate-table__hint--danger {
  color: var(--el-color-danger);
}

.web-ui-collect-candidate-table__hint--warning {
  color: var(--el-color-warning-dark-2);
}

.web-ui-collect-candidate-table__hint--success {
  color: var(--el-color-success);
}

.web-ui-collect-candidate-table :deep(.el-select) {
  width: 100%;
}

.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__editable .el-input__wrapper),
.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__editable.el-select .el-select__wrapper) {
  min-height: 30px;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-subtle);
  box-shadow: inset 0 0 0 1px var(--app-border-soft);
}

.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__editable .el-input__wrapper:hover),
.web-ui-collect-candidate-table :deep(.web-ui-collect-candidate-table__editable.el-select .el-select__wrapper:hover) {
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}
</style>
