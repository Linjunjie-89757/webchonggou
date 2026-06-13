<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import type { AssignDefectPayload, DefectSummaryItem } from '@/entities/defect'
import { userApi, type UserItem } from '@/entities/user'
import { getRequestErrorMessage } from '@/shared/api/error'
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
const users = ref<UserItem[]>([])
const usersLoading = ref(false)
const usersError = ref('')
let usersLoaded = false

function getUserLabel(user: UserItem) {
  return user.displayName || user.username || `用户 ${user.id}`
}

async function loadUsers() {
  if (usersLoaded || usersLoading.value) {
    return
  }

  usersLoading.value = true
  usersError.value = ''
  try {
    users.value = await userApi.getUsers()
    usersLoaded = true
  } catch (error) {
    usersError.value = getRequestErrorMessage(error)
  } finally {
    usersLoading.value = false
  }
}

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
      void loadUsers()
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
        <span>处理人 *</span>
        <el-select
          v-model="form.assigneeId"
          class="defect-assign-dialog__select"
          :disabled="usersLoading"
          :loading="usersLoading"
          filterable
          placeholder="请选择处理人"
        >
          <el-option
            v-for="user in users"
            :key="user.id"
            :label="getUserLabel(user)"
            :value="String(user.id)"
          >
            <div class="defect-assign-dialog__option">
              <span>{{ getUserLabel(user) }}</span>
              <small>{{ user.username }}</small>
            </div>
          </el-option>
        </el-select>
        <small v-if="usersError" class="defect-assign-dialog__field-error">{{ usersError }}</small>
      </label>

      <p v-if="formError.message" class="defect-assign-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="defect-assign-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submit">保存指派</AppButton>
      </div>
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
  line-height: var(--app-line-height-md);
  white-space: normal;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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

.defect-assign-dialog__select {
  width: 100%;
}

.defect-assign-dialog__option {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.defect-assign-dialog__option span {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-assign-dialog__option small {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-assign-dialog__field-error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-assign-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.defect-assign-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.defect-assign-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
