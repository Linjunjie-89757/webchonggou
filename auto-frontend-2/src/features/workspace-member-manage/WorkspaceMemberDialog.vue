<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import type { WorkspaceMemberItem } from '@/entities/workspace'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateWorkspaceMemberPayload,
  buildUpdateWorkspaceMemberPayload,
  createDefaultWorkspaceMemberForm,
  createWorkspaceMemberFormFromItem,
  type WorkspaceMemberDialogMode,
  type WorkspaceMemberForm,
  validateWorkspaceMemberForm,
  workspaceMemberRoleOptions,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: WorkspaceMemberDialogMode
    member?: WorkspaceMemberItem | null
    saving?: boolean
  }>(),
  {
    member: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  create: [payload: ReturnType<typeof buildCreateWorkspaceMemberPayload>]
  update: [payload: ReturnType<typeof buildUpdateWorkspaceMemberPayload>]
}>()

const form = reactive<WorkspaceMemberForm>(createDefaultWorkspaceMemberForm())
const formError = ref('')

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.member
      ? createWorkspaceMemberFormFromItem(props.member)
      : createDefaultWorkspaceMemberForm()

  Object.assign(form, nextForm)
  formError.value = ''
}

function submit() {
  const error = validateWorkspaceMemberForm(form, props.mode)
  if (error) {
    formError.value = error
    return
  }

  formError.value = ''
  if (props.mode === 'edit') {
    emit('update', buildUpdateWorkspaceMemberPayload(form))
  } else {
    emit('create', buildCreateWorkspaceMemberPayload(form))
  }
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
  () => props.member,
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
    :title="mode === 'create' ? '添加空间成员' : '编辑成员角色'"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="workspace-member-dialog">
      <label class="workspace-member-dialog__field">
        <span>用户 ID {{ mode === 'create' ? '*' : '' }}</span>
        <el-input-number
          v-model="form.userId"
          :min="1"
          :controls="false"
          :disabled="mode === 'edit'"
          placeholder="请输入用户 ID"
        />
      </label>

      <div class="workspace-member-dialog__field">
        <span>角色</span>
        <div class="workspace-member-dialog__segment">
          <button
            v-for="item in workspaceMemberRoleOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.roleCode === item.value }"
            @click="form.roleCode = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError" class="workspace-member-dialog__error">{{ formError }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.workspace-member-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.workspace-member-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.workspace-member-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.workspace-member-dialog__segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.workspace-member-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.workspace-member-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.workspace-member-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.workspace-member-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
