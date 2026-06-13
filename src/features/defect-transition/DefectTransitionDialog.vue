<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { defectStatusOptions, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'
import { userApi, type UserItem } from '@/entities/user'
import { getRequestErrorMessage } from '@/shared/api/error'
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
const users = ref<UserItem[]>([])
const usersLoading = ref(false)
const usersError = ref('')
let usersLoaded = false
const targetStatusOptions = computed(() =>
  defectStatusOptions.filter((item) => item.value !== props.defectItem?.status),
)
const selectedUser = computed(() => users.value.find((user) => String(user.id) === form.assigneeId) ?? null)

function getUserLabel(user: UserItem) {
  return user.displayName || user.username || `用户 ${user.id}`
}

function getUserInitial(user: UserItem) {
  const label = getUserLabel(user).trim()
  return label ? label.slice(0, 1).toUpperCase() : 'U'
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
    title="处理缺陷"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-transition-dialog">
      <div class="defect-transition-dialog__summary">
        <span>{{ defectItem?.bugNo || '-' }}</span>
        <strong>{{ defectItem?.title || '-' }}</strong>
      </div>

      <div class="defect-transition-dialog__field">
        <span>处理人</span>
        <el-select
          v-model="form.assigneeId"
          class="defect-transition-dialog__select"
          :disabled="usersLoading"
          :loading="usersLoading"
          clearable
          filterable
          placeholder="可选，变更处理人"
        >
          <template v-if="selectedUser" #label>
            <div class="defect-transition-dialog__selected">
              <span class="defect-transition-dialog__avatar">{{ getUserInitial(selectedUser) }}</span>
              <span class="defect-transition-dialog__selected-name">{{ getUserLabel(selectedUser) }}</span>
            </div>
          </template>
          <el-option
            v-for="user in users"
            :key="user.id"
            :label="getUserLabel(user)"
            :value="String(user.id)"
          >
            <div class="defect-transition-dialog__option">
              <span class="defect-transition-dialog__avatar defect-transition-dialog__avatar--option">
                {{ getUserInitial(user) }}
              </span>
              <span class="defect-transition-dialog__option-name">{{ getUserLabel(user) }}</span>
            </div>
          </el-option>
        </el-select>
        <small v-if="usersError" class="defect-transition-dialog__field-error">{{ usersError }}</small>
      </div>

      <div class="defect-transition-dialog__field">
        <span>目标状态 *</span>
        <div class="defect-transition-dialog__segment">
          <button
            v-for="item in targetStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.toStatus === item.value }"
            @click="form.toStatus = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="defect-transition-dialog__hint">
          若当前缺陷不支持所选目标状态，保存时会显示服务端返回的失败原因。
        </p>
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
      <div class="defect-transition-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submit">保存流转</AppButton>
      </div>
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
  line-height: var(--app-line-height-md);
  white-space: normal;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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

.defect-transition-dialog__select {
  width: 100%;
}

.defect-transition-dialog__selected,
.defect-transition-dialog__option {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.defect-transition-dialog__selected {
  width: 100%;
}

.defect-transition-dialog__avatar {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.defect-transition-dialog__avatar--option {
  width: 30px;
  height: 30px;
}

.defect-transition-dialog__selected-name,
.defect-transition-dialog__option-name {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-transition-dialog__field-error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-transition-dialog :deep(.el-select__wrapper) {
  min-height: 40px;
}

.defect-transition-dialog :deep(.el-select__selection) {
  min-width: 0;
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

.defect-transition-dialog__hint {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
}

.defect-transition-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.defect-transition-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 640px) {
  .defect-transition-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
