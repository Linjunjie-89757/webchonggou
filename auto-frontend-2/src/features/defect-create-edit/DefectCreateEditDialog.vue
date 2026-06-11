<script setup lang="ts">
import { reactive, watch } from 'vue'

import {
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectDetail,
  type DefectSummaryItem,
} from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  createDefectFormFromDetail,
  createDefectFormFromSummary,
  type DefectDialogMode,
  type DefectForm,
  validateDefectForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DefectDialogMode
    defectItem?: DefectSummaryItem | null
    defectDetail?: DefectDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
  }>(),
  {
    defectItem: null,
    defectDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveDefectPayload>]
  retryDetail: []
}>()

const form = reactive<DefectForm>(createDefaultDefectForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.defectDetail
      ? createDefectFormFromDetail(props.defectDetail)
      : props.mode === 'edit' && props.defectItem
        ? createDefectFormFromSummary(props.defectItem, props.defaultWorkspaceCode)
        : createDefaultDefectForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateDefectForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveDefectPayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => [props.defectItem, props.defectDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增缺陷' : '编辑缺陷'"
    width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-dialog">
      <div v-if="loadingDetail" class="defect-dialog__hint">正在加载缺陷详情...</div>
      <div v-else-if="detailErrorMessage" class="defect-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <AppButton size="small" @click="emit('retryDetail')">重试</AppButton>
      </div>

      <label class="defect-dialog__field">
        <span>工作空间</span>
        <el-input v-model="form.workspaceCode" disabled placeholder="ALL" />
      </label>

      <label class="defect-dialog__field">
        <span>缺陷标题 *</span>
        <el-input v-model="form.title" :disabled="loadingDetail" placeholder="请输入缺陷标题" />
      </label>

      <div class="defect-dialog__grid">
        <div class="defect-dialog__field">
          <span>优先级 *</span>
          <div class="defect-dialog__segment is-four">
            <button
              v-for="item in defectPriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': form.priority === item.value }"
              :disabled="loadingDetail"
              @click="form.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="defect-dialog__field">
          <span>严重级别 *</span>
          <el-select
            v-model="form.severity"
            class="defect-dialog__select"
            :disabled="loadingDetail"
          >
            <el-option
              v-for="item in defectSeverityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
      </div>

      <div class="defect-dialog__grid">
        <label class="defect-dialog__field">
          <span>处理人 ID *</span>
          <el-input v-model="form.assigneeId" :disabled="loadingDetail" placeholder="请输入数字 ID" />
        </label>

        <label class="defect-dialog__field">
          <span>关联用例 ID</span>
          <el-input v-model="form.relatedCaseId" :disabled="loadingDetail" placeholder="可选" />
        </label>
      </div>

      <label class="defect-dialog__field">
        <span>标签</span>
        <el-input
          v-model="form.tagsText"
          :disabled="loadingDetail"
          placeholder="多个标签用逗号或换行分隔"
        />
      </label>

      <label class="defect-dialog__field">
        <span>缺陷描述 *</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="5"
          :disabled="loadingDetail"
          placeholder="请输入复现现象、影响范围或必要上下文"
        />
      </label>

      <p v-if="formError.message" class="defect-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton
        type="primary"
        :loading="saving"
        :disabled="loadingDetail || Boolean(detailErrorMessage)"
        @click="submit"
      >
        保存
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3) var(--app-space-4);
}

.defect-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-dialog__select {
  width: 100%;
}

.defect-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.defect-dialog__segment.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.defect-dialog__segment button {
  min-height: var(--app-control-height-md);
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.defect-dialog__segment button:hover:not(:disabled) {
  background: var(--app-bg-page);
}

.defect-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-dialog__segment button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.defect-dialog__hint,
.defect-dialog__error-panel {
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.defect-dialog__hint {
  border: 1px solid var(--app-border);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
}

.defect-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.defect-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .defect-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
