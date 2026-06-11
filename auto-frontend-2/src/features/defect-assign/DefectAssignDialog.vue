<script setup lang="ts">
import { reactive, watch } from 'vue'

import type { AssignDefectPayload, DefectSummaryItem } from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildAssignPayload,
  createDefaultAssignForm,
  type DefectAssignForm,
  validateAssignForm,
} from './assignDefect'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defectItem?: DefectSummaryItem | null
    workspaceCode?: string
    saving?: boolean
  }>(),
  {
    defectItem: null,
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: AssignDefectPayload]
}>()

const form = reactive<DefectAssignForm>(createDefaultAssignForm())
const formError = reactive({
  message: '',
})

function resetForm() {
  Object.assign(form, createDefaultAssignForm())
  formError.message = ''
}

function submit() {
  const error = validateAssignForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildAssignPayload(form, props.workspaceCode))
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
  () => props.defectItem,
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
    title="指派缺陷"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-assign-dialog">
      <div class="defect-assign-dialog__summary">
        <span>{{ defectItem?.bugNo || '-' }}</span>
        <strong>{{ defectItem?.title || '-' }}</strong>
      </div>

      <label class="defect-assign-dialog__field">
        <span>处理人 ID *</span>
        <el-input v-model="form.assigneeId" placeholder="请输入数字 ID" />
      </label>

      <p v-if="formError.message" class="defect-assign-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存指派</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-assign-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-assign-dialog__summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.defect-assign-dialog__summary span,
.defect-assign-dialog__summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-assign-dialog__summary span {
  color: var(--app-text-subtle);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.defect-assign-dialog__summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-base);
}

.defect-assign-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-assign-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-assign-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
