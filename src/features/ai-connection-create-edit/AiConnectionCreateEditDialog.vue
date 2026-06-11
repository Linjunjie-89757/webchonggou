<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'

import type { AiProviderConnectionItem } from '@/entities/ai-provider'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  aiConnectionProtocolOptions,
  aiConnectionStatusOptions,
  buildSaveAiConnectionPayload,
  createAiConnectionFormFromItem,
  createDefaultAiConnectionForm,
  type AiConnectionDialogMode,
  type AiConnectionForm,
  validateAiConnectionForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: AiConnectionDialogMode
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
  submit: [payload: ReturnType<typeof buildSaveAiConnectionPayload>]
}>()

const form = reactive<AiConnectionForm>(createDefaultAiConnectionForm(props.defaultWorkspaceCode))
const formError = ref('')
const apiKeyVisible = ref(false)

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.provider
      ? createAiConnectionFormFromItem(props.provider)
      : createDefaultAiConnectionForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.value = ''
  apiKeyVisible.value = false
}

function submit() {
  const error = validateAiConnectionForm(form, props.mode)
  if (error) {
    formError.value = error
    return
  }

  formError.value = ''
  emit('submit', buildSaveAiConnectionPayload(form, {
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
    <div class="ai-connection-dialog">
      <label class="ai-connection-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </label>

      <label class="ai-connection-dialog__field">
        <span>连接名称 *</span>
        <el-input v-model="form.connectionName" placeholder="例如：OpenAI 主连接" />
      </label>

      <div class="ai-connection-dialog__field">
        <span>协议类型</span>
        <div class="ai-connection-dialog__segment">
          <button
            v-for="item in aiConnectionProtocolOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.protocolType === item.value }"
            @click="form.protocolType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <label class="ai-connection-dialog__field">
        <span>Base URL *</span>
        <el-input v-model="form.baseUrl" placeholder="https://api.example.com/v1" />
      </label>

      <label class="ai-connection-dialog__field">
        <span>模型名称 *</span>
        <el-input v-model="form.modelName" placeholder="例如：gpt-4.1" />
      </label>

      <label class="ai-connection-dialog__field">
        <span>API Key {{ mode === 'create' ? '*' : '' }}</span>
        <el-input
          v-model="form.apiKey"
          :type="apiKeyVisible ? 'text' : 'password'"
          autocomplete="current-password"
          :placeholder="mode === 'edit' ? '留空则继续使用已保存密钥' : '请输入 API Key'"
        >
          <template #suffix>
            <button
              type="button"
              class="ai-connection-dialog__password-toggle"
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

      <div class="ai-connection-dialog__grid">
        <label class="ai-connection-dialog__field">
          <span>请求超时（秒）</span>
          <el-input-number v-model="form.requestTimeoutSeconds" :min="10" :max="600" />
        </label>

        <div class="ai-connection-dialog__field">
          <span>状态</span>
          <div class="ai-connection-dialog__segment is-two">
            <button
              v-for="item in aiConnectionStatusOptions"
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

      <p v-if="formError" class="ai-connection-dialog__error">{{ formError }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.ai-connection-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.ai-connection-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.ai-connection-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.ai-connection-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.ai-connection-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.ai-connection-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-connection-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.ai-connection-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.ai-connection-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.ai-connection-dialog__password-toggle {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
}

.ai-connection-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .ai-connection-dialog__grid,
  .ai-connection-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
