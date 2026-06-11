<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'

import {
  aiProviderBrands,
  inferAiProviderBrand,
  type AiProviderBrand,
  type AiProviderConnectionItem,
} from '@/entities/ai-provider'
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
const dialogStep = ref<'provider' | 'config'>('provider')
const selectedBrand = ref<AiProviderBrand>(aiProviderBrands[0])

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.provider
      ? createAiConnectionFormFromItem(props.provider)
      : createDefaultAiConnectionForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.value = ''
  apiKeyVisible.value = false

  if (props.mode === 'edit' && props.provider) {
    selectedBrand.value = inferAiProviderBrand(props.provider)
    dialogStep.value = 'config'
  } else {
    selectedBrand.value = aiProviderBrands[0]
    dialogStep.value = 'provider'
  }
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

function selectBrand(brand: AiProviderBrand) {
  selectedBrand.value = brand
  form.connectionName = `${brand.shortName} 连接`
  form.protocolType = brand.protocolType
  form.baseUrl = brand.baseUrl
  form.modelName = brand.models[0] ?? ''
  formError.value = ''
  dialogStep.value = 'config'
}

function backToProviderStep() {
  if (props.mode === 'create') {
    formError.value = ''
    dialogStep.value = 'provider'
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
    :title="mode === 'create' && dialogStep === 'provider' ? '选择供应商' : mode === 'create' ? '配置连接' : '编辑 AI 连接'"
    width="min(760px, calc(100vw - 32px))"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ai-connection-dialog">
      <section v-if="mode === 'create' && dialogStep === 'provider'" class="ai-connection-provider-step">
        <p>选择要接入的 AI 服务供应商，下一步会带入默认协议、地址和模型建议。</p>
        <div class="ai-connection-provider-grid">
          <button
            v-for="brand in aiProviderBrands"
            :key="brand.id"
            type="button"
            class="ai-connection-provider-card"
            @click="selectBrand(brand)"
          >
            <span class="ai-connection-brand" :class="`ai-connection-brand--${brand.tone}`">
              {{ brand.mark }}
            </span>
            <span>
              <strong>{{ brand.name }}</strong>
              <small>{{ brand.description }}</small>
            </span>
          </button>
        </div>
      </section>

      <section v-else class="ai-connection-config-step">
        <button
          v-if="mode === 'create'"
          type="button"
          class="ai-connection-dialog__back"
          @click="backToProviderStep"
        >
          重新选择供应商
        </button>

        <div class="ai-connection-selected-provider">
          <span class="ai-connection-brand" :class="`ai-connection-brand--${selectedBrand.tone}`">
            {{ selectedBrand.mark }}
          </span>
          <span>
            <strong>{{ selectedBrand.name }}</strong>
            <small>{{ selectedBrand.description }}</small>
          </span>
        </div>

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
      </section>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton
        v-if="mode === 'create' && dialogStep === 'provider'"
        type="primary"
        @click="selectBrand(selectedBrand)"
      >
        下一步
      </AppButton>
      <AppButton v-else type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.ai-connection-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.ai-connection-provider-step,
.ai-connection-config-step {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.ai-connection-provider-step > p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.ai-connection-provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.ai-connection-provider-card {
  display: flex;
  min-width: 0;
  min-height: 96px;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.ai-connection-provider-card:hover {
  border-color: var(--app-primary);
  box-shadow: var(--app-shadow-card);
  transform: translateY(-1px);
}

.ai-connection-provider-card > span:last-child,
.ai-connection-selected-provider > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.ai-connection-provider-card strong,
.ai-connection-selected-provider strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-provider-card small,
.ai-connection-selected-provider small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ai-connection-selected-provider {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.ai-connection-brand {
  display: inline-flex;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 800;
  line-height: 1;
}

.ai-connection-brand--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.ai-connection-brand--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.ai-connection-brand--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.ai-connection-brand--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.ai-connection-brand--purple {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.ai-connection-dialog__back {
  width: fit-content;
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
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

@media (prefers-reduced-motion: reduce) {
  .ai-connection-provider-card {
    transition: none;
  }

  .ai-connection-provider-card:hover {
    transform: none;
  }
}

@media (max-width: 720px) {
  .ai-connection-provider-grid,
  .ai-connection-dialog__grid,
  .ai-connection-dialog__segment {
    grid-template-columns: 1fr;
  }

  .ai-connection-provider-card {
    min-height: 88px;
  }
}
</style>
