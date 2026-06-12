<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, RefreshCw, Wifi } from '@lucide/vue'

import {
  aiProviderApi,
  aiProviderBrands,
  inferAiProviderBrand,
  type AiProviderBrand,
  type AiProviderConnectionItem,
  type AiProviderModelItem,
} from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
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
const dialogTesting = ref(false)
const dialogTestResult = reactive<{
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
}>({
  status: 'idle',
  message: '',
})
const modelLoading = ref(false)
const modelError = ref('')
const providerModels = ref<AiProviderModelItem[]>([])
const showModelDropdown = ref(false)
let modelRequestSeq = 0

const hasSavedProvider = computed(() => Boolean(props.provider))

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.provider
      ? createAiConnectionFormFromItem(props.provider)
      : createDefaultAiConnectionForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.value = ''
  apiKeyVisible.value = false
  resetDialogFeedback()
  resetModelState()

  if (props.mode === 'edit' && props.provider) {
    selectedBrand.value = inferAiProviderBrand(props.provider)
    dialogStep.value = 'config'
    void loadProviderModels({ sync: false })
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
  resetDialogFeedback()
  resetModelState()
  dialogStep.value = 'config'
}

function backToProviderStep() {
  if (props.mode === 'create') {
    formError.value = ''
    dialogStep.value = 'provider'
  }
}

function restoreDefaultBaseUrl() {
  form.baseUrl = selectedBrand.value.baseUrl
}

function resetDialogFeedback() {
  dialogTesting.value = false
  dialogTestResult.status = 'idle'
  dialogTestResult.message = ''
}

function resetModelState() {
  modelLoading.value = false
  modelError.value = ''
  providerModels.value = []
  showModelDropdown.value = false
  modelRequestSeq += 1
}

function applyProviderModels(models: AiProviderModelItem[], options: { openDropdown: boolean; preserveCurrent: boolean }) {
  providerModels.value = models
  if (!models.length) {
    showModelDropdown.value = false
    return
  }

  const currentModelName = form.modelName.trim()
  const matched = models.find((item) => item.modelName === currentModelName)
  if (!options.preserveCurrent || !currentModelName) {
    form.modelName = matched?.modelName ?? models[0].modelName
  }
  showModelDropdown.value = options.openDropdown
}

async function loadProviderModels(options: { sync: boolean } = { sync: true }) {
  if (!props.provider) {
    modelError.value = '保存连接后即可获取模型列表'
    return
  }

  const currentSeq = ++modelRequestSeq
  modelLoading.value = true
  modelError.value = ''
  showModelDropdown.value = false

  try {
    const models = options.sync
      ? (await aiProviderApi.syncProviderModels(props.defaultWorkspaceCode, props.provider.id)).models
      : await aiProviderApi.getProviderModels(props.defaultWorkspaceCode, props.provider.id)

    if (currentSeq === modelRequestSeq) {
      applyProviderModels(Array.isArray(models) ? models : [], {
        openDropdown: options.sync,
        preserveCurrent: !options.sync,
      })
    }
  } catch (error) {
    if (currentSeq === modelRequestSeq) {
      modelError.value = getRequestErrorMessage(error)
    }
  } finally {
    if (currentSeq === modelRequestSeq) {
      modelLoading.value = false
    }
  }
}

function selectProviderModel(model: AiProviderModelItem) {
  form.modelName = model.modelName
  showModelDropdown.value = false
}

async function testDialogProvider() {
  if (!props.provider) {
    dialogTestResult.status = 'error'
    dialogTestResult.message = '保存连接后即可测试连接状态'
    return
  }

  dialogTesting.value = true
  dialogTestResult.status = 'testing'
  dialogTestResult.message = '正在测试连接...'

  try {
    const result = await aiProviderApi.testProviderConnection(props.defaultWorkspaceCode, props.provider.id)
    dialogTestResult.status = result.success ? 'success' : 'error'
    dialogTestResult.message = result.message || (result.success ? '连接测试成功' : '连接测试未通过')
  } catch (error) {
    dialogTestResult.status = 'error'
    dialogTestResult.message = getRequestErrorMessage(error)
  } finally {
    dialogTesting.value = false
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
    class="ai-connection-create-edit-dialog"
    :class="{ 'is-provider-select-step': mode === 'create' && dialogStep === 'provider' }"
    :model-value="modelValue"
    :title="mode === 'create' && dialogStep === 'provider' ? '选择供应商' : mode === 'create' ? '配置连接' : '编辑连接'"
    width="min(672px, calc(100vw - 32px))"
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
            <span
              class="ai-connection-brand"
              :class="[
                `ai-connection-brand--${brand.tone}`,
                brand.logoClass,
                { 'has-logo-image': brand.logoSrc },
              ]"
            >
              <img v-if="brand.logoSrc" :src="brand.logoSrc" :alt="brand.name">
              <span>{{ brand.shortName.slice(0, 1) }}</span>
            </span>
            <span>
              <strong>{{ brand.name }}</strong>
              <small>{{ brand.description }}</small>
            </span>
            <ChevronRight class="ai-connection-provider-card__arrow" :size="16" />
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
          <ChevronLeft :size="13" />
          重新选择供应商
        </button>

        <div class="ai-connection-selected-provider">
          <span
            class="ai-connection-brand"
            :class="[
              `ai-connection-brand--${selectedBrand.tone}`,
              selectedBrand.logoClass,
              { 'has-logo-image': selectedBrand.logoSrc },
            ]"
          >
            <img v-if="selectedBrand.logoSrc" :src="selectedBrand.logoSrc" :alt="selectedBrand.name">
            <span>{{ selectedBrand.shortName.slice(0, 1) }}</span>
          </span>
          <span>
            <strong>{{ selectedBrand.name }}</strong>
            <small>{{ selectedBrand.description }}</small>
          </span>
        </div>

        <label class="ai-connection-dialog__field">
          <span>连接名称</span>
          <el-input v-model="form.connectionName" placeholder="例如：OpenAI 官方 / DeepSeek 代理 / 内网网关" />
        </label>

        <div class="ai-connection-dialog__field">
          <span class="ai-connection-dialog__label-row">
            API URL
            <button type="button" @click="restoreDefaultBaseUrl">恢复默认</button>
          </span>
          <el-input v-model="form.baseUrl" class="is-mono" :placeholder="selectedBrand.baseUrl" />
          <small>支持自定义代理地址或私有部署地址</small>
        </div>

        <label class="ai-connection-dialog__field">
          <span>API Key {{ mode === 'create' ? '*' : '' }}</span>
          <el-input
            v-model="form.apiKey"
            class="is-mono"
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

        <div class="ai-connection-dialog__field">
          <span class="ai-connection-dialog__label-row">
            模型名称
            <button
              type="button"
              class="ai-connection-dialog__fetch-models"
              :disabled="modelLoading || !hasSavedProvider"
              @click="loadProviderModels({ sync: true })"
            >
              <RefreshCw v-if="modelLoading" :size="13" class="is-spinning" />
              <Download v-else :size="13" />
              {{ modelLoading ? '获取中...' : '获取模型列表' }}
            </button>
          </span>
          <div class="ai-connection-dialog__model-wrap">
            <el-input v-model="form.modelName" class="is-mono" placeholder="例如：gpt-4o、deepseek-chat、qwen-max" />
            <button
              v-if="providerModels.length"
              type="button"
              class="ai-connection-dialog__model-toggle"
              :aria-expanded="showModelDropdown"
              aria-label="展开模型列表"
              @click="showModelDropdown = !showModelDropdown"
            >
              <ChevronRight :size="14" :class="{ 'is-open': showModelDropdown }" />
            </button>
            <div v-if="showModelDropdown && providerModels.length" class="ai-connection-dialog__model-dropdown">
              <div class="ai-connection-dialog__model-head">
                <span>共 {{ providerModels.length }} 个模型</span>
                <span>点击选择</span>
              </div>
              <div class="ai-connection-dialog__model-list">
                <button
                  v-for="item in providerModels"
                  :key="item.id"
                  type="button"
                  :class="{ 'is-selected': item.modelName === form.modelName }"
                  @click="selectProviderModel(item)"
                >
                  <span>{{ item.displayName || item.modelName }}</span>
                  <Check v-if="item.modelName === form.modelName" :size="14" />
                </button>
              </div>
            </div>
          </div>
          <p v-if="modelError" class="ai-connection-dialog__model-message is-error">
            <AlertCircle :size="13" />
            <span>{{ modelError }}</span>
          </p>
          <p v-else-if="mode === 'create'" class="ai-connection-dialog__model-message">
            <AlertCircle :size="13" />
            <span>保存连接后即可从服务端获取模型列表。</span>
          </p>
        </div>

        <details class="ai-connection-dialog__advanced">
          <summary>高级配置</summary>
          <label class="ai-connection-dialog__field">
            <span>目标空间</span>
            <el-input v-model="form.workspaceCode" placeholder="ALL" />
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
        </details>

        <p v-if="formError" class="ai-connection-dialog__error">{{ formError }}</p>
      </section>
    </div>

    <template #footer>
      <div class="ai-connection-dialog__footer">
        <div v-if="mode !== 'create' || dialogStep === 'config'" class="ai-connection-dialog__test-area">
          <button
            type="button"
            class="ai-connection-dialog__test-button"
            :disabled="dialogTesting || !hasSavedProvider"
            @click="testDialogProvider"
          >
            <Wifi :size="16" :class="{ 'is-pulsing': dialogTesting }" />
            {{ dialogTesting ? '测试中...' : '测试连接' }}
          </button>
          <div
            v-if="dialogTestResult.status !== 'idle'"
            class="ai-connection-dialog__test-result"
            :class="`is-${dialogTestResult.status}`"
          >
            <RefreshCw v-if="dialogTestResult.status === 'testing'" :size="14" class="is-spinning" />
            <Check v-else-if="dialogTestResult.status === 'success'" :size="14" />
            <AlertCircle v-else :size="14" />
            <span>{{ dialogTestResult.message }}</span>
          </div>
        </div>
        <span v-else aria-hidden="true" />
        <div class="ai-connection-dialog__footer-actions">
          <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
          <AppButton
            v-if="mode === 'create' && dialogStep === 'provider'"
            type="primary"
            @click="selectBrand(selectedBrand)"
          >
            下一步
          </AppButton>
          <AppButton v-else type="primary" :loading="saving" @click="submit">
            {{ mode === 'edit' ? '保存修改' : '添加连接' }}
          </AppButton>
        </div>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.ai-connection-dialog {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ai-connection-provider-step,
.ai-connection-config-step {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
}

.ai-connection-provider-step > p {
  margin: 0 0 2px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.5;
}

.ai-connection-provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-connection-provider-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 86px;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  text-align: left;
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.ai-connection-provider-card:hover {
  border-color: #93c5fd;
  background: #f8fbff;
  box-shadow: 0 14px 34px rgba(37, 99, 235, 0.1);
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
  color: #111827;
  font-size: 14px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-provider-card small,
.ai-connection-selected-provider small {
  display: -webkit-box;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ai-connection-provider-card__arrow {
  flex: 0 0 auto;
  margin-left: auto;
  color: #9ca3af;
  transition: color 180ms ease, transform 180ms ease;
}

.ai-connection-provider-card:hover .ai-connection-provider-card__arrow {
  color: #2563eb;
  transform: translateX(2px);
}

.ai-connection-selected-provider {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.03);
}

.ai-connection-brand {
  position: relative;
  display: inline-flex;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 2px 7px rgba(15, 23, 42, 0.12);
}

.ai-connection-brand img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.ai-connection-brand.has-logo-image {
  border-color: transparent !important;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.ai-connection-brand.has-logo-image > span {
  display: none;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.ai-connection-dialog__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-connection-dialog__label-row button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
}

.ai-connection-dialog__fetch-models {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 5px 10px !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 8px;
  background: #fff !important;
  color: #6b7280 !important;
  line-height: 16px;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.ai-connection-dialog__fetch-models:hover:not(:disabled) {
  border-color: #93c5fd !important;
  background: #f8fbff !important;
  color: #3b82f6 !important;
}

.ai-connection-dialog__fetch-models:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
  gap: 6px;
}

.ai-connection-dialog__field > span {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.ai-connection-dialog__field small {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.4;
}

.ai-connection-dialog :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 12px;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}

.ai-connection-dialog :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #60a5fa inset, 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.ai-connection-dialog :deep(.is-mono .el-input__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.ai-connection-dialog__model-wrap {
  position: relative;
}

.ai-connection-dialog__model-wrap :deep(.el-input__wrapper) {
  padding-right: 42px;
}

.ai-connection-dialog__model-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  z-index: 2;
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transform: translateY(-50%);
  transition: background-color 180ms ease;
}

.ai-connection-dialog__model-toggle:hover {
  background: #e5e7eb;
}

.ai-connection-dialog__model-toggle svg {
  transition: transform 180ms ease;
  transform: rotate(90deg);
}

.ai-connection-dialog__model-toggle svg.is-open {
  transform: rotate(-90deg);
}

.ai-connection-dialog__model-dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
}

.ai-connection-dialog__model-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #9ca3af;
  font-size: 12px;
}

.ai-connection-dialog__model-head span:last-child {
  color: #2563eb;
}

.ai-connection-dialog__model-list {
  max-height: 192px;
  overflow-y: auto;
  scrollbar-width: none;
}

.ai-connection-dialog__model-list::-webkit-scrollbar {
  display: none;
}

.ai-connection-dialog__model-list button {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  background: #fff;
  color: #374151;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

.ai-connection-dialog__model-list button:hover,
.ai-connection-dialog__model-list button.is-selected {
  background: #eff6ff;
  color: #1d4ed8;
}

.ai-connection-dialog__model-list button > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-dialog__model-list svg {
  flex: 0 0 auto;
  color: #1d4ed8;
}

.ai-connection-dialog__model-message {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 2px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.ai-connection-dialog__model-message svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.ai-connection-dialog__model-message.is-error {
  color: #ef4444;
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

.ai-connection-dialog__advanced {
  display: grid;
  gap: var(--app-space-4);
  padding: 10px 12px;
  border: 1px solid #eef2f7;
  border-radius: 14px;
  background: #fbfdff;
}

.ai-connection-dialog__advanced summary {
  color: #64748b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.ai-connection-dialog__advanced[open] summary {
  margin-bottom: var(--app-space-4);
}

.ai-connection-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.ai-connection-dialog__footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ai-connection-dialog__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-connection-dialog__test-area {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.ai-connection-dialog__test-button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.ai-connection-dialog__test-button:hover:not(:disabled) {
  background: #f9fafb;
}

.ai-connection-dialog__test-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-connection-dialog__test-result {
  display: inline-flex;
  max-width: 360px;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.ai-connection-dialog__test-result span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-dialog__test-result svg {
  flex: 0 0 auto;
}

.ai-connection-dialog__test-result.is-testing {
  border-color: #dbeafe;
  background: #eff6ff;
  color: #2563eb;
}

.ai-connection-dialog__test-result.is-success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #16a34a;
}

.ai-connection-dialog__test-result.is-error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.is-pulsing {
  animation: ai-connection-dialog-pulse 1s ease-in-out infinite;
}

.is-spinning {
  animation: ai-connection-dialog-spin 900ms linear infinite;
}

@keyframes ai-connection-dialog-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes ai-connection-dialog-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.62;
    transform: scale(0.92);
  }
}

:global(.ai-connection-create-edit-dialog.el-dialog) {
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
}

:global(.ai-connection-create-edit-dialog .el-dialog__header) {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 0 24px;
  border-bottom: 1px solid #f3f4f6;
}

:global(.ai-connection-create-edit-dialog .el-dialog__title) {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

:global(.ai-connection-create-edit-dialog .el-dialog__headerbtn) {
  position: static;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  transform: none;
  transition: background-color 180ms ease;
}

:global(.ai-connection-create-edit-dialog .el-dialog__headerbtn:hover) {
  background: #f3f4f6;
}

:global(.ai-connection-create-edit-dialog .el-dialog__close) {
  color: #9ca3af;
  font-size: 18px;
}

:global(.ai-connection-create-edit-dialog .el-dialog__body) {
  max-height: calc(90vh - 128px);
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: none;
}

:global(.ai-connection-create-edit-dialog .el-dialog__body::-webkit-scrollbar) {
  display: none;
}

:global(.ai-connection-create-edit-dialog .el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
}

:global(.ai-connection-create-edit-dialog.is-provider-select-step .el-dialog__body) {
  max-height: calc(90vh - 64px);
}

:global(.ai-connection-create-edit-dialog.is-provider-select-step .el-dialog__footer) {
  display: none;
}

:global(.ai-connection-create-edit-dialog .el-button) {
  min-height: 36px;
  padding: 8px 16px;
  border-radius: 10px;
}

:global(.ai-connection-create-edit-dialog .el-button--primary) {
  min-width: 96px;
  background: #2563eb;
  border-color: #2563eb;
  font-weight: 600;
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
