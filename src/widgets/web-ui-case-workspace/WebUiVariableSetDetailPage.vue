<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type CreateParamPayload,
  type ParamSetItem,
} from '@/entities/config'
import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultWebUiVariable,
  createDefaultWebUiVariableSetForm,
  parseWebUiVariables,
  validateConfigParamForm,
  type ConfigParamForm,
} from '@/features/config-param-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
  }>(),
  {
    workspaceReady: true,
  },
)

const route = useRoute()
const router = useRouter()
const variableSet = ref<ParamSetItem | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const formError = ref('')
const renameDialogVisible = ref(false)
const renameValue = ref('')
const variablePageNo = ref(1)
const variablePageSize = ref(10)
const form = reactive<ConfigParamForm>(createDefaultWebUiVariableSetForm(props.workspaceCode))

const variableSetId = computed(() => Number(route.params.id || 0))
const variableCount = computed(() => form.variables.filter(variable => variable.name.trim()).length)
const sensitiveCount = computed(() => form.variables.filter(variable => variable.name.trim() && variable.sensitive).length)
const workspaceLabel = computed(() => variableSet.value?.workspaceName || variableSet.value?.workspaceCode || '-')
const pagedVariables = computed(() => {
  const start = (variablePageNo.value - 1) * variablePageSize.value
  return form.variables.slice(start, start + variablePageSize.value)
})

function normalizeVariablePageNo() {
  const totalPages = Math.max(1, Math.ceil(form.variables.length / variablePageSize.value))
  if (variablePageNo.value > totalPages) {
    variablePageNo.value = totalPages
  }
}

function getVariableIndex(pageIndex: number) {
  return (variablePageNo.value - 1) * variablePageSize.value + pageIndex
}

function handleVariablePageSizeChange(value: number) {
  variablePageSize.value = value
  variablePageNo.value = 1
}

async function loadVariableSet() {
  if (!props.workspaceReady || !variableSetId.value) {
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsParams(props.workspaceCode, {
      paramType: 'WEB_UI_VARIABLE_SET',
    })
    const item = page.items.find(variableSet => variableSet.id === variableSetId.value) || null
    if (!item) {
      errorMessage.value = '变量集不存在或当前空间不可访问'
      variableSet.value = null
      return
    }
    variableSet.value = item
    Object.assign(form, createConfigParamFormFromItem(item))
    form.paramType = 'WEB_UI_VARIABLE_SET'
    formError.value = ''
    variablePageNo.value = 1
    normalizeVariablePageNo()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function goBack() {
  void router.push('/automation/web/variables')
}

function openRenameDialog() {
  renameValue.value = form.paramName
  renameDialogVisible.value = true
}

function addVariable() {
  form.variables.push(createDefaultWebUiVariable())
  variablePageNo.value = Math.max(1, Math.ceil(form.variables.length / variablePageSize.value))
}

function removeVariable(index: number) {
  form.variables.splice(index, 1)
  if (form.variables.length === 0) {
    addVariable()
  }
  normalizeVariablePageNo()
}

function clearInvalidVariables() {
  const validVariables = form.variables.filter(variable => variable.name.trim() || variable.value.trim() || variable.description.trim())
  form.variables.splice(0, form.variables.length, ...(validVariables.length ? validVariables : [createDefaultWebUiVariable()]))
  variablePageNo.value = 1
}

async function importVariablesFromJson() {
  const input = window.prompt('请输入变量 JSON 数组，例如：[{"name":"USERNAME","value":"admin","sensitive":false}]')
  if (input === null) {
    return
  }

  const variables = parseWebUiVariables(input)
  if (variables.length === 0) {
    formError.value = '未识别到有效变量，请检查 JSON 格式'
    return
  }

  form.variables.splice(0, form.variables.length, ...variables)
  formError.value = ''
  variablePageNo.value = 1
  ElMessage.success(`已导入 ${variables.length} 个变量`)
}

async function exportVariablesToJson() {
  const text = JSON.stringify(
    form.variables
      .filter(variable => variable.name.trim())
      .map(variable => ({
        name: variable.name.trim(),
        value: variable.value,
        sensitive: variable.sensitive,
        description: variable.description.trim(),
      })),
    null,
    2,
  )

  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('变量 JSON 已复制到剪贴板')
  } catch {
    formError.value = text
  }
}

async function saveVariableSet() {
  if (!variableSet.value) {
    return
  }

  const error = validateConfigParamForm(form)
  if (error) {
    formError.value = error
    return
  }

  saving.value = true
  try {
    const payload: CreateParamPayload = {
      ...buildCreateParamPayload(form),
      workspaceCode: props.workspaceCode === 'ALL' ? form.workspaceCode : props.workspaceCode,
      paramType: 'WEB_UI_VARIABLE_SET',
    }
    const updated = await configApi.updateSettingsParam(props.workspaceCode, variableSet.value.id, payload)
    variableSet.value = updated
    Object.assign(form, createConfigParamFormFromItem(updated))
    form.paramType = 'WEB_UI_VARIABLE_SET'
    formError.value = ''
    normalizeVariablePageNo()
    ElMessage.success('变量集已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function saveVariableSetName() {
  const nextName = renameValue.value.trim()
  if (!nextName) {
    formError.value = '请输入变量集名称'
    return
  }
  form.paramName = nextName
  renameDialogVisible.value = false
  await saveVariableSet()
}

onMounted(() => {
  void loadVariableSet()
})

watch(
  () => [props.workspaceCode, props.workspaceReady, route.params.id] as const,
  () => {
    void loadVariableSet()
  },
)
</script>

<template>
  <section class="web-ui-variable-detail">
    <header class="web-ui-variable-detail__header">
      <div class="web-ui-variable-detail__title">
        <AppButton :icon="ArrowLeft" @click="goBack">返回</AppButton>
        <div>
          <div class="web-ui-variable-detail__name-row">
            <h2>{{ form.paramName || '变量集详情' }}</h2>
            <el-button :icon="Edit" link type="primary" @click="openRenameDialog">更改</el-button>
          </div>
          <p>维护变量集基础信息和变量列表，保存后会影响引用该变量集的 Web UI 运行。</p>
        </div>
      </div>
      <div class="web-ui-variable-detail__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadVariableSet">刷新</AppButton>
        <AppButton type="primary" :loading="saving" @click="saveVariableSet">保存</AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && !variableSet" text="正在加载变量集..." />

    <AppEmptyState
      v-else-if="errorMessage && !variableSet"
      title="变量集加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadVariableSet">重试</AppButton>
      </template>
    </AppEmptyState>

    <template v-else>
      <section class="web-ui-variable-detail__summary">
        <div class="web-ui-variable-detail__metric">
          <span>所属空间</span>
          <strong>{{ workspaceLabel }}</strong>
        </div>
        <div class="web-ui-variable-detail__metric">
          <span>变量数量</span>
          <strong>{{ variableCount }}</strong>
        </div>
        <div class="web-ui-variable-detail__metric">
          <span>敏感变量</span>
          <strong>{{ sensitiveCount }}</strong>
        </div>
        <div class="web-ui-variable-detail__metric">
          <span>状态</span>
          <strong>{{ form.status === 1 ? '启用' : '停用' }}</strong>
        </div>
      </section>

      <section class="web-ui-variable-detail__section">
        <div class="web-ui-variable-detail__toolbar">
          <div>
            <h3>变量列表</h3>
            <p>变量名只能包含字母、数字、下划线，步骤中通过 <code v-pre>{{变量名}}</code> 引用。</p>
          </div>
          <div class="web-ui-variable-detail__tools">
            <el-button @click="importVariablesFromJson">JSON 导入</el-button>
            <el-button @click="exportVariablesToJson">JSON 导出</el-button>
            <el-button @click="clearInvalidVariables">清空无效行</el-button>
            <el-button type="primary" :icon="Plus" @click="addVariable">新增变量</el-button>
          </div>
        </div>

        <el-table class="web-ui-variable-detail__table" :data="pagedVariables" border>
          <el-table-column label="变量名" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="USERNAME" />
            </template>
          </el-table-column>
          <el-table-column label="变量值" min-width="260">
            <template #default="{ row }">
              <el-input
                v-model="row.value"
                :type="row.sensitive ? 'password' : 'text'"
                placeholder="变量值"
                show-password
              />
            </template>
          </el-table-column>
          <el-table-column label="敏感" width="88" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.sensitive" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="240">
            <template #default="{ row }">
              <el-input v-model="row.description" placeholder="用途说明" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="84" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link @click="removeVariable(getVariableIndex($index))">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="form.variables.length > variablePageSize" class="web-ui-variable-detail__pagination">
          <el-pagination
            v-model:current-page="variablePageNo"
            v-model:page-size="variablePageSize"
            :total="form.variables.length"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            @size-change="handleVariablePageSizeChange"
          />
        </div>

        <p v-if="formError" class="web-ui-variable-detail__error">{{ formError }}</p>
      </section>

      <el-dialog
        v-model="renameDialogVisible"
        title="更改变量集名称"
        width="460px"
        destroy-on-close
      >
        <el-form label-width="96px">
          <el-form-item label="变量集名称" required>
            <el-input v-model="renameValue" maxlength="80" show-word-limit />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="web-ui-variable-detail__dialog-footer">
            <AppButton :disabled="saving" @click="renameDialogVisible = false">取消</AppButton>
            <AppButton type="primary" :loading="saving" @click="saveVariableSetName">保存</AppButton>
          </div>
        </template>
      </el-dialog>
    </template>
  </section>
</template>

<style scoped>
.web-ui-variable-detail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-variable-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-variable-detail__title {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--app-space-3);
}

.web-ui-variable-detail__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.web-ui-variable-detail__title h2,
.web-ui-variable-detail__section h3,
.web-ui-variable-detail__toolbar h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-variable-detail__title p,
.web-ui-variable-detail__toolbar p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.web-ui-variable-detail__actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--app-space-2);
}

.web-ui-variable-detail__summary {
  display: grid;
  gap: var(--app-space-3);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.web-ui-variable-detail__metric,
.web-ui-variable-detail__section {
  border: 1px solid var(--app-border-light);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
}

.web-ui-variable-detail__metric {
  display: flex;
  min-height: 76px;
  flex-direction: column;
  justify-content: center;
  padding: var(--app-space-4);
}

.web-ui-variable-detail__metric span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-variable-detail__metric strong {
  margin-top: var(--app-space-1);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-variable-detail__section {
  padding: var(--app-space-4);
}

.web-ui-variable-detail__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
}

.web-ui-variable-detail__tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-variable-detail__table {
  width: 100%;
}

.web-ui-variable-detail__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--app-space-3);
}

.web-ui-variable-detail__error {
  margin: var(--app-space-3) 0 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.web-ui-variable-detail :deep(.el-select) {
  width: 100%;
}

.web-ui-variable-detail__dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

@media (max-width: 900px) {
  .web-ui-variable-detail__header,
  .web-ui-variable-detail__title,
  .web-ui-variable-detail__toolbar {
    flex-direction: column;
  }

  .web-ui-variable-detail__summary {
    grid-template-columns: 1fr;
  }
}
</style>
