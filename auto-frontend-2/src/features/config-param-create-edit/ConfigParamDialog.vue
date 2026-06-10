<script setup lang="ts">
import { reactive, watch } from 'vue'

import { configParamTypeOptions, configStatusOptions, type ParamSetItem } from '@/entities/config'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  type ConfigParamDialogMode,
  type ConfigParamForm,
  validateConfigParamForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigParamDialogMode
    param?: ParamSetItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    param: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateParamPayload>]
}>()

const form = reactive<ConfigParamForm>(createDefaultConfigParamForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.param
      ? createConfigParamFormFromItem(props.param)
      : createDefaultConfigParamForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateConfigParamForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateParamPayload(form))
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
  () => props.param,
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
    :title="mode === 'create' ? '新增参数' : '编辑参数'"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-param-dialog">
      <label class="config-param-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </label>

      <label class="config-param-dialog__field">
        <span>参数名 *</span>
        <el-input v-model="form.paramName" placeholder="例如：REQUEST_TIMEOUT" />
      </label>

      <label class="config-param-dialog__field">
        <span>参数值 *</span>
        <el-input
          v-model="form.value"
          :type="form.sensitive ? 'password' : 'text'"
          placeholder="请输入参数值"
        />
      </label>

      <div class="config-param-dialog__field">
        <span>参数类型</span>
        <div class="config-param-dialog__segment">
          <button
            v-for="item in configParamTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.paramType === item.value }"
            @click="form.paramType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <label class="config-param-dialog__field">
        <span>说明</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该参数的用途或取值规则"
        />
      </label>

      <label class="config-param-dialog__checkbox">
        <input v-model="form.sensitive" type="checkbox">
        <span>敏感参数（密码、密钥等）</span>
      </label>

      <div class="config-param-dialog__field">
        <span>状态</span>
        <div class="config-param-dialog__segment is-two">
          <button
            v-for="item in configStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.status === item.value }"
            @click="form.status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError.message" class="config-param-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-param-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-param-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-param-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-param-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.config-param-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-param-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-param-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.config-param-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-param-dialog__checkbox {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-param-dialog__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--app-primary);
}

.config-param-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
