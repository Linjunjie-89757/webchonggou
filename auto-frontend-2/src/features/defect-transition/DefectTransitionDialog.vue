<script setup lang="ts">
import { reactive, watch } from 'vue'

import { defectStatusOptions, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildTransitionPayload,
  createDefaultTransitionForm,
  type DefectTransitionForm,
  validateTransitionForm,
} from './transitionDefect'

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
  submit: [payload: TransitionDefectPayload]
}>()

const form = reactive<DefectTransitionForm>(createDefaultTransitionForm())
const formError = reactive({
  message: '',
})

function resetForm() {
  Object.assign(form, createDefaultTransitionForm(props.defectItem))
  formError.message = ''
}

function submit() {
  const error = validateTransitionForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildTransitionPayload(form, props.workspaceCode))
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
    title="流转缺陷"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-transition-dialog">
      <div class="defect-transition-dialog__summary">
        <span>{{ defectItem?.bugNo || '-' }}</span>
        <strong>{{ defectItem?.title || '-' }}</strong>
      </div>

      <div class="defect-transition-dialog__field">
        <span>目标状态 *</span>
        <div class="defect-transition-dialog__segment">
          <button
            v-for="item in defectStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.toStatus === item.value }"
            @click="form.toStatus = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <label class="defect-transition-dialog__field">
        <span>流转备注</span>
        <el-input
          v-model="form.actionComment"
          type="textarea"
          :rows="4"
          maxlength="300"
          show-word-limit
          placeholder="可选"
        />
      </label>

      <p v-if="formError.message" class="defect-transition-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存流转</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-transition-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-transition-dialog__summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.defect-transition-dialog__summary span,
.defect-transition-dialog__summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-transition-dialog__summary span {
  color: var(--app-text-subtle);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.defect-transition-dialog__summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-base);
}

.defect-transition-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-transition-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-transition-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.defect-transition-dialog__segment button {
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

.defect-transition-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.defect-transition-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-transition-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 640px) {
  .defect-transition-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
