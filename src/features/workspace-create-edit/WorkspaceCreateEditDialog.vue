<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

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

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: WorkspaceDialogMode
    workspace?: WorkspaceItem | null
    saving?: boolean
  }>(),
  {
    workspace: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveWorkspacePayload>]
}>()

const form = reactive<WorkspaceForm>(createDefaultWorkspaceForm())
const formError = ref('')

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
    width="620px"
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
        <el-input v-model="form.workspaceName" placeholder="请输入空间名称" />
      </label>

      <label class="workspace-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="补充空间用途或说明"
        />
      </label>

      <div class="workspace-dialog__grid">
        <label class="workspace-dialog__field">
          <span>空间类型</span>
          <el-select v-model="form.workspaceType">
            <el-option
              v-for="item in workspaceTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </label>

        <label class="workspace-dialog__field">
          <span>负责人 ID</span>
          <el-input-number v-model="form.ownerUserId" :min="1" :controls="false" placeholder="可留空" />
        </label>
      </div>

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
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.workspace-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.workspace-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.workspace-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.workspace-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.workspace-dialog__segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.workspace-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.workspace-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.workspace-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.workspace-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .workspace-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
