<script setup lang="ts">
import { reactive, watch } from 'vue'

import {
  caseReviewStatusOptions,
  type CaseSummaryItem,
  type ReviewCasePayload,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import { createDefaultReviewPayload } from './reviewCase'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    caseItem?: CaseSummaryItem | null
    saving?: boolean
  }>(),
  {
    caseItem: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReviewCasePayload]
}>()

const form = reactive<ReviewCasePayload>({
  reviewStatus: 'PASSED',
  reviewComment: '',
})

const formError = reactive({
  message: '',
})

function resetForm() {
  Object.assign(form, props.caseItem ? createDefaultReviewPayload(props.caseItem) : {
    reviewStatus: 'PASSED',
    reviewComment: '',
  })
  formError.message = ''
}

function submit() {
  if (!form.reviewStatus) {
    formError.message = '请选择评审结果'
    return
  }

  formError.message = ''
  emit('submit', { ...form })
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
  () => props.caseItem,
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
    title="评审用例"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-review-dialog">
      <div class="case-review-dialog__summary">
        <span>{{ caseItem?.caseNo || '-' }}</span>
        <strong>{{ caseItem?.title || '-' }}</strong>
      </div>

      <div class="case-review-dialog__field">
        <span>评审结果</span>
        <div class="case-review-dialog__segment">
          <button
            v-for="item in caseReviewStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.reviewStatus === item.value }"
            @click="form.reviewStatus = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="case-review-dialog__field">
        <span>评审意见</span>
        <el-input
          v-model="form.reviewComment"
          type="textarea"
          :rows="4"
          maxlength="300"
          show-word-limit
          placeholder="可选"
        />
      </div>

      <p v-if="formError.message" class="case-review-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存评审</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-review-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-review-dialog__summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.case-review-dialog__summary span,
.case-review-dialog__summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-review-dialog__summary span {
  color: var(--app-text-subtle);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.case-review-dialog__summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-base);
}

.case-review-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-review-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-review-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.case-review-dialog__segment button {
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

.case-review-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.case-review-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-review-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
