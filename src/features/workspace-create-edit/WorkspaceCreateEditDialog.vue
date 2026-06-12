<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Package, Target, Users } from '@lucide/vue'

import type { WorkspaceItem } from '@/entities/workspace'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveWorkspacePayload,
  createDefaultWorkspaceForm,
  createWorkspaceFormFromItem,
  type WorkspaceDialogMode,
  type WorkspaceForm,
  workspaceStatusOptions,
  workspaceTypeOptions,
  validateWorkspaceForm,
} from './model'

interface WorkspaceOwnerOption {
  value: number
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: WorkspaceDialogMode
    workspace?: WorkspaceItem | null
    ownerOptions?: WorkspaceOwnerOption[]
    saving?: boolean
  }>(),
  {
    workspace: null,
    ownerOptions: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveWorkspacePayload>]
}>()

const form = reactive<WorkspaceForm>(createDefaultWorkspaceForm())
const formError = ref('')
const workspaceTypeIcons = {
  package: Package,
  users: Users,
  target: Target,
}

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.workspace
      ? createWorkspaceFormFromItem(props.workspace)
      : createDefaultWorkspaceForm()

  Object.assign(form, nextForm)
  formError.value = ''
}

function submit() {
  const error = validateWorkspaceForm(form, props.mode)
  if (error) {
    formError.value = error
    return
  }

  formError.value = ''
  emit('submit', buildSaveWorkspacePayload(form))
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
  () => props.workspace,
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
    :title="mode === 'create' ? '新增工作空间' : '编辑工作空间'"
    width="512px"
    class="workspace-create-edit-dialog"
    modal-class="workspace-create-edit-dialog__overlay"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="workspace-dialog">
      <label class="workspace-dialog__field">
        <span>空间编码 *</span>
        <el-input
          v-model="form.workspaceCode"
          placeholder="例如：project-alpha"
          :disabled="mode === 'edit'"
        />
      </label>

      <label class="workspace-dialog__field">
        <span>空间名称 *</span>
        <el-input v-model="form.workspaceName" placeholder="例如：开户工作空间" />
      </label>

      <label class="workspace-dialog__field">
        <span>空间描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该工作空间的用途和范围"
        />
      </label>

      <div class="workspace-dialog__field">
        <span>空间类型</span>
        <div class="workspace-dialog__type-grid">
          <button
            v-for="item in workspaceTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.workspaceType === item.value }"
            @click="form.workspaceType = item.value"
          >
            <component
              :is="workspaceTypeIcons[item.icon]"
              class="workspace-dialog__type-icon"
              :size="24"
              aria-hidden="true"
            />
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </button>
        </div>
      </div>

      <label class="workspace-dialog__field">
        <span>负责人（Owner）</span>
        <select v-model="form.ownerUserId" class="workspace-dialog__select">
          <option :value="null">组织管理员</option>
          <option v-for="item in ownerOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <small>负责人拥有空间最高权限，创建后可通过成员管理添加管理员和成员</small>
      </label>

      <div class="workspace-dialog__field">
        <span>状态</span>
        <div class="workspace-dialog__segment">
          <button
            v-for="item in workspaceStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.status === item.value }"
            @click="form.status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError" class="workspace-dialog__error">{{ formError }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">
        {{ mode === 'create' ? '创建空间' : '保存修改' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.workspace-create-edit-dialog :deep(.el-dialog) {
  max-height: 90vh;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
}

.workspace-create-edit-dialog :deep(.el-dialog__header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--app-border-soft);
}

.workspace-create-edit-dialog :deep(.el-dialog__title) {
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}

.workspace-create-edit-dialog :deep(.el-dialog__headerbtn) {
  position: static;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.workspace-create-edit-dialog :deep(.el-dialog__headerbtn:hover) {
  background: var(--app-border-soft);
}

.workspace-create-edit-dialog :deep(.el-dialog__body) {
  max-height: calc(90vh - 132px);
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: none;
}

.workspace-create-edit-dialog :deep(.el-dialog__body::-webkit-scrollbar) {
  display: none;
}

.workspace-create-edit-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid var(--app-border-soft);
}

.workspace-create-edit-dialog :deep(.dialog-footer),
.workspace-create-edit-dialog :deep(.el-dialog__footer) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.workspace-dialog {
  display: grid;
  gap: 20px;
}

.workspace-dialog__field {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.workspace-dialog__field > span {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.workspace-dialog__field > small {
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.workspace-dialog :deep(.el-input__wrapper),
.workspace-dialog :deep(.el-textarea__inner),
.workspace-dialog__select {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
  box-shadow: none;
  color: var(--app-text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.workspace-dialog :deep(.el-input__wrapper) {
  min-height: 42px;
  padding: 0 12px;
}

.workspace-dialog :deep(.el-input__wrapper.is-focus),
.workspace-dialog :deep(.el-textarea__inner:focus),
.workspace-dialog__select:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 2px rgb(37 99 235 / 16%);
}

.workspace-dialog :deep(.el-textarea__inner) {
  min-height: 82px !important;
  padding: 10px 12px;
  resize: none;
}

.workspace-dialog :deep(.el-input__inner::placeholder),
.workspace-dialog :deep(.el-textarea__inner::placeholder) {
  color: var(--app-text-subtle);
}

.workspace-dialog__type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.workspace-dialog__type-grid button {
  display: grid;
  min-height: 94px;
  align-content: center;
  justify-items: center;
  gap: 4px;
  padding: 12px;
  border: 2px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.workspace-dialog__type-grid button:hover {
  border-color: var(--app-border-strong);
}

.workspace-dialog__type-grid button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.workspace-dialog__type-grid strong {
  color: var(--app-text-primary);
  font-size: 12px;
  font-weight: 500;
}

.workspace-dialog__type-grid small {
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 1.35;
}

.workspace-dialog__type-icon {
  margin-bottom: 4px;
}

.workspace-dialog__select {
  width: 100%;
  height: 42px;
  padding: 0 12px;
}

.workspace-dialog__segment {
  display: flex;
  gap: 12px;
}

.workspace-dialog__segment button {
  flex: 1;
  height: 42px;
  border: 2px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.workspace-dialog__segment button:hover {
  border-color: var(--app-border-strong);
}

.workspace-dialog__segment button.is-active {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: #15803d;
}

.workspace-dialog__segment button:nth-child(2).is-active {
  border-color: var(--app-border);
  background: var(--app-border-soft);
  color: var(--app-text-primary);
}

.workspace-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .workspace-dialog__type-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.workspace-create-edit-dialog__overlay {
  background: rgb(0 0 0 / 30%);
  backdrop-filter: blur(8px);
}
</style>
