<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import { configStatusOptions } from '@/entities/config'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  aiProviderProtocolOptions,
  buildSaveAiProviderPayload,
  createAiProviderFormFromItem,
  createDefaultAiProviderForm,
  type AiProviderDialogMode,
  type AiProviderForm,
  validateAiProviderForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: AiProviderDialogMode
    provider?: AiProviderConnectionItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    provider: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveAiProviderPayload>]
}>()

const form = reactive<AiProviderForm>(createDefaultAiProviderForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const apiKeyVisible = ref(false)

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.provider
      ? createAiProviderFormFromItem(props.provider)
      : createDefaultAiProviderForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
  apiKeyVisible.value = false
}

function submit() {
  const error = validateAiProviderForm(form, props.mode)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveAiProviderPayload(form, {
    includeApiKey: props.mode === 'create' || Boolean(form.apiKey.trim()),
  }))
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
  () => props.provider,
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
    :title="mode === 'create' ? '新增 AI 连接' : '编辑 AI 连接'"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ai-provider-dialog">
      <label class="ai-provider-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </label>

      <label class="ai-provider-dialog__field">
        <span>连接名称 *</span>
        <el-input v-model="form.connectionName" placeholder="例如：OpenAI 主连接" />
      </label>

      <div class="ai-provider-dialog__field">
        <span>协议类型</span>
        <div class="ai-provider-dialog__segment">
          <button
            v-for="item in aiProviderProtocolOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.protocolType === item.value }"
            @click="form.protocolType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <label class="ai-provider-dialog__field">
        <span>Base URL *</span>
        <el-input v-model="form.baseUrl" placeholder="https://api.example.com/v1" />
      </label>

      <label class="ai-provider-dialog__field">
        <span>模型名称 *</span>
        <el-input v-model="form.modelName" placeholder="例如：gpt-4.1" />
      </label>

      <label class="ai-provider-dialog__field">
        <span>API Key {{ mode === 'create' ? '*' : '' }}</span>
        <el-input
          v-model="form.apiKey"
          :type="apiKeyVisible ? 'text' : 'password'"
          autocomplete="current-password"
          :placeholder="mode === 'edit' ? '留空沿用旧密钥' : '请输入 API Key'"
        >
          <template #suffix>
            <button
              type="button"
              class="ai-provider-dialog__password-toggle"
              :aria-label="apiKeyVisible ? '隐藏 API Key' : '显示 API Key'"
              @click="apiKeyVisible = !apiKeyVisible"
            >
              <el-icon>
                <View v-if="!apiKeyVisible" />
                <Hide v-else />
              </el-icon>
            </button>
          </template>
        </el-input>
      </label>

      <div class="ai-provider-dialog__grid is-two">
        <label class="ai-provider-dialog__field">
          <span>请求超时（秒）</span>
          <el-input-number v-model="form.requestTimeoutSeconds" :min="1" :max="600" />
        </label>

        <div class="ai-provider-dialog__field">
          <span>状态</span>
          <div class="ai-provider-dialog__segment is-two">
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
      </div>

      <p v-if="formError.message" class="ai-provider-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.ai-provider-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.ai-provider-dialog__grid {
  display: grid;
  gap: var(--app-space-4);
}

.ai-provider-dialog__grid.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-provider-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.ai-provider-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.ai-provider-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.ai-provider-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-provider-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.ai-provider-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.ai-provider-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.ai-provider-dialog__password-toggle {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
}

.ai-provider-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .ai-provider-dialog__grid.is-two,
  .ai-provider-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
