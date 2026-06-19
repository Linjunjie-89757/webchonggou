<script setup lang="ts">
import { reactive, watch } from 'vue'

import {
  apiMethodOptions,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
} from '@/entities/api-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

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
  <AppDialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增接口用例' : '编辑接口用例'"
    width="760px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="api-case-dialog">
      <div v-if="loadingDetail" class="api-case-dialog__hint">正在加载用例详情...</div>
      <div v-else-if="detailErrorMessage" class="api-case-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <AppButton size="small" @click="emit('retryDetail')">重试</AppButton>
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

      <div class="api-case-dialog__carry-summary">
        <span>请求配置已带入</span>
        <span>断言 {{ form.assertions.length }} 项</span>
        <span>前置处理 {{ form.preProcessors.length }} 项</span>
        <span>后置处理 {{ form.postProcessors.length }} 项</span>
      </div>

      <div class="api-case-dialog__field">
        <span>用例名称 *</span>
        <el-input v-model="form.name" :disabled="loadingDetail" placeholder="请输入用例名称" />
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
          <span>超时时间 ms *</span>
          <el-input v-model="form.timeoutMs" :disabled="loadingDetail" placeholder="10000" />
        </div>

        <div class="api-case-dialog__field">
          <span>标签</span>
          <el-input v-model="form.tagsText" :disabled="loadingDetail" placeholder="多个标签用逗号或换行分隔" />
        </div>
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

    <template #footer>
      <div class="api-case-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="loadingDetail || Boolean(detailErrorMessage)"
          @click="submit"
        >
          保存
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
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

.api-case-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.api-case-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 720px) {
  .api-case-dialog__grid,
  .api-case-dialog__grid.is-request {
    grid-template-columns: 1fr;
  }
}
</style>
