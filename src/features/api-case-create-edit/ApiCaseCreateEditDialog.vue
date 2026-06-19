<script setup lang="ts">
import { reactive, watch } from 'vue'
import { X } from '@lucide/vue'

import {
  apiMethodOptions,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
} from '@/entities/api-automation'

import {
  buildSaveApiCasePayload,
  createApiCaseFormFromDetail,
  createApiCaseFormFromSummary,
  createDefaultApiCaseForm,
  type ApiCaseDialogMode,
  type ApiCaseForm,
  validateApiCaseForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ApiCaseDialogMode
    definition: ApiDefinitionItem | null
    caseItem?: ApiDefinitionCaseItem | null
    caseDetail?: ApiDefinitionCaseDetail | null
    caseDraftDetail?: ApiDefinitionCaseDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    caseDraftDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveApiCasePayload>]
  retryDetail: []
}>()

const form = reactive<ApiCaseForm>(createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.caseDetail
      ? createApiCaseFormFromDetail(props.caseDetail)
      : props.mode === 'edit' && props.caseItem
        ? createApiCaseFormFromSummary(props.caseItem, props.definition, props.defaultWorkspaceCode)
        : props.mode === 'create' && props.caseDraftDetail
          ? createApiCaseFormFromDetail(props.caseDraftDetail)
        : createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateApiCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveApiCasePayload(form))
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
  () => [props.definition, props.caseItem, props.caseDetail, props.caseDraftDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    append-to-body
    destroy-on-close
    :with-header="false"
    :show-close="false"
    close-on-click-modal
    close-on-press-escape
    modal-class="api-case-drawer-modal"
    size="894px"
    class="api-case-edit-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="api-case-drawer-shell">
      <div class="api-case-drawer-top">
        <div class="api-case-drawer-header">
          <div class="api-case-drawer-title">{{ mode === 'create' ? '新建用例' : '编辑用例' }}</div>
          <div class="api-case-drawer-subtitle">{{ form.definitionName || '未选择接口' }}</div>
        </div>
        <button type="button" class="api-case-drawer-close" @click="emit('update:modelValue', false)">
          <X />
        </button>
      </div>

      <div class="api-case-drawer-scroll">
        <div class="api-case-drawer-summary-card">
          <div class="api-case-drawer-summary-meta">
            <span :class="['api-case-drawer-method-tag', `request-method-${form.method.toLowerCase()}`]">{{ form.method }}</span>
            <span class="api-case-drawer-summary-path">{{ form.path || '未设置路径' }}</span>
          </div>
        </div>

        <div v-if="loadingDetail" class="api-case-dialog__hint">正在加载用例详情...</div>
        <div v-else-if="detailErrorMessage" class="api-case-dialog__error-panel">
          <span>{{ detailErrorMessage }}</span>
          <button type="button" class="api-case-inline-button" @click="emit('retryDetail')">重试</button>
        </div>

        <div class="api-case-drawer-name-row">
          <el-input
            v-model="form.name"
            :disabled="loadingDetail"
            maxlength="255"
            show-word-limit
            placeholder="请输入用例名称"
            class="api-case-drawer-name-input"
          />
        </div>

        <div class="api-case-drawer-meta-row">
          <el-select model-value="P0" class="api-case-drawer-meta-field" disabled>
            <el-option label="P0" value="P0" />
          </el-select>
          <el-select model-value="进行中" class="api-case-drawer-meta-field" disabled>
            <el-option label="进行中" value="进行中" />
          </el-select>
          <el-select
            v-model="form.tagsText"
            class="api-case-drawer-tags-field"
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :teleported="false"
            placeholder="输入内容后回车可直接添加标签"
          >
            <el-option
              v-for="tag in form.tagsText.split(/[,，\n]/).map(item => item.trim()).filter(Boolean)"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </div>

        <div class="api-case-dialog__carry-summary">
          <span>请求配置已带入</span>
          <span>断言 {{ form.assertions.length }} 项</span>
          <span>前置处理 {{ form.preProcessors.length }} 项</span>
          <span>后置处理 {{ form.postProcessors.length }} 项</span>
        </div>

        <div class="api-case-dialog__grid is-request">
          <div class="api-case-dialog__field">
            <span>请求方法 *</span>
            <el-select v-model="form.method" class="api-case-dialog__select" :disabled="loadingDetail">
              <el-option v-for="item in apiMethodOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </div>

          <div class="api-case-dialog__field">
            <span>请求路径 *</span>
            <el-input v-model="form.path" :disabled="loadingDetail" placeholder="/api/example 或完整 URL" />
          </div>
        </div>

        <div class="api-case-dialog__grid">
          <div class="api-case-dialog__field">
            <span>所属接口定义</span>
            <el-input :model-value="form.definitionName || '-'" disabled />
          </div>

          <div class="api-case-dialog__field">
            <span>工作空间</span>
            <el-input v-model="form.workspaceCode" disabled placeholder="ALL" />
          </div>
        </div>

        <div class="api-case-dialog__field">
          <span>超时时间 ms *</span>
          <el-input v-model="form.timeoutMs" :disabled="loadingDetail" placeholder="10000" />
        </div>

        <div class="api-case-dialog__field">
          <span>描述</span>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            :disabled="loadingDetail"
            placeholder="补充用例场景、前置条件或注意事项"
          />
        </div>

        <p v-if="formError.message" class="api-case-dialog__error">{{ formError.message }}</p>
      </div>

      <div class="api-case-drawer-footer">
        <button type="button" class="api-case-drawer-cancel-button" :disabled="saving" @click="emit('update:modelValue', false)">取消</button>
        <button
          type="button"
          class="api-case-drawer-submit-button"
          :disabled="loadingDetail || Boolean(detailErrorMessage) || saving"
          @click="submit"
        >
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:global(.api-case-drawer-modal) {
  background: rgba(15, 23, 42, 0.28);
}

.api-case-edit-drawer :deep(.el-drawer) {
  max-width: calc(100vw - 24px);
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  border-radius: 16px 0 0 16px;
  box-shadow: -24px 0 56px rgba(15, 23, 42, 0.16);
}

.api-case-edit-drawer :deep(.el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.api-case-drawer-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.api-case-drawer-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-drawer-title {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-case-drawer-subtitle {
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}

.api-case-drawer-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.api-case-drawer-close:hover,
.api-case-drawer-close:focus-visible {
  background: #f3f4f6;
  color: #374151;
}

.api-case-drawer-close svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.api-case-drawer-scroll {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 20px 24px 24px;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.api-case-drawer-summary-card {
  padding: 0;
}

.api-case-drawer-summary-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-case-drawer-method-tag {
  display: inline-flex;
  min-width: 44px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.api-case-drawer-method-tag.request-method-get,
.api-case-drawer-method-tag.request-method-head {
  color: #15803d;
}

.api-case-drawer-method-tag.request-method-post {
  color: #ea580c;
}

.api-case-drawer-method-tag.request-method-put {
  color: #2563eb;
}

.api-case-drawer-method-tag.request-method-delete {
  color: #dc2626;
}

.api-case-drawer-method-tag.request-method-patch,
.api-case-drawer-method-tag.request-method-options {
  color: #7c3aed;
}

.api-case-drawer-method-tag.request-method-trace {
  color: #6b7280;
}

.api-case-drawer-summary-path {
  min-width: 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}

.api-case-drawer-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.api-case-drawer-name-input :deep(.el-input__wrapper),
.api-case-drawer-meta-field :deep(.el-select__wrapper),
.api-case-dialog__field :deep(.el-input__wrapper),
.api-case-dialog__field :deep(.el-textarea__inner),
.api-case-dialog__field :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-case-drawer-name-input :deep(.el-input__wrapper:hover),
.api-case-drawer-meta-field :deep(.el-select__wrapper:hover),
.api-case-dialog__field :deep(.el-input__wrapper:hover),
.api-case-dialog__field :deep(.el-textarea__inner:hover),
.api-case-dialog__field :deep(.el-select__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #9ca3af;
}

.api-case-drawer-tags-field :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-case-drawer-meta-row {
  display: grid;
  grid-template-columns: 140px 140px minmax(0, 1fr);
  gap: 12px;
}

.api-case-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-submit-button,
.api-case-drawer-cancel-button,
.api-case-inline-button {
  min-width: 76px;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.api-case-drawer-submit-button {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-case-drawer-submit-button:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.api-case-drawer-submit-button:disabled {
  border-color: #93c5fd;
  background: #93c5fd;
  cursor: not-allowed;
}

.api-case-drawer-cancel-button,
.api-case-inline-button {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
}

.api-case-drawer-cancel-button:hover,
.api-case-inline-button:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.api-case-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.api-case-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3) var(--app-space-4);
}

.api-case-dialog__grid.is-request {
  grid-template-columns: 160px minmax(0, 1fr);
}

.api-case-dialog__carry-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-case-dialog__carry-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-case-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.api-case-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-case-dialog__select {
  width: 100%;
}

.api-case-dialog__hint,
.api-case-dialog__error-panel {
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.api-case-dialog__hint {
  border: 1px solid var(--app-border);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
}

.api-case-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-case-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .api-case-dialog__grid,
  .api-case-dialog__grid.is-request,
  .api-case-drawer-meta-row {
    grid-template-columns: 1fr;
  }
}
</style>
