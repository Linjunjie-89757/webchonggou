<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Connection, MoreFilled, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  ConfigStatCard,
  ConfigTypeBadge,
  configApi,
  configParamTypeOptions,
  configStatusOptions,
  getParamCategory,
  getParamDescriptionText,
  getParamTypeMeta,
  getParamValueText,
  type ConfigReferenceSummary,
  type ConfigStat,
  type ConfigStatus,
  type CreateParamPayload,
  type ParamSetChangeHistoryItem,
  type ParamSetItem,
  type ParamSetVersionItem,
} from '@/entities/config'
import {
  buildCreateParamPayload,
  ConfigParamDialog,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  createDefaultWebUiVariable,
  parseWebUiVariables,
  type ConfigParamDialogMode,
  type ConfigParamForm,
} from '@/features/config-param-create-edit'
import { deleteConfigParam } from '@/features/config-param-delete'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
import ConfigParamChangeHistoryDrawer from '@/widgets/config-param-change-history-drawer/ConfigParamChangeHistoryDrawer.vue'
import ConfigParamVersionDrawer from '@/widgets/config-param-version-drawer/ConfigParamVersionDrawer.vue'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type ParamCategoryFilter = '' | 'global' | 'business' | 'api' | 'webUi' | 'appUi'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const params = ref<ParamSetItem[]>([])
const activeCategory = ref<ParamCategoryFilter>('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const changeHistoryDrawerVisible = ref(false)
const changeHistoryLoading = ref(false)
const changeHistoryItems = ref<ParamSetChangeHistoryItem[]>([])
const versionDrawerVisible = ref(false)
const versionLoading = ref(false)
const versionItems = ref<ParamSetVersionItem[]>([])
const versionParam = ref<ParamSetItem | null>(null)
const rollbackingVersionId = ref<number | null>(null)
const dialogMode = ref<ConfigParamDialogMode>('create')
const editingParam = ref<ParamSetItem | null>(null)
const deletingParamId = ref<number | null>(null)
const filterKeyword = ref('')
const filterStatus = ref('')
const detailParam = ref<ParamSetItem | null>(null)
const detailForm = reactive<ConfigParamForm>(createDefaultConfigParamForm(props.workspaceCode))
const detailKeyword = ref('')
const detailError = ref('')
let suppressFilterLoad = false

const filteredParams = computed(() => {
  if (!activeCategory.value) {
    return params.value
  }
  return params.value.filter(item => getParamCategory(item) === activeCategory.value)
})

const stats = computed<ConfigStat[]>(() => [
  { label: '全局公共变量', value: params.value.filter((item) => getParamCategory(item) === 'global').length, tone: 'primary' },
  { label: '通用业务变量', value: params.value.filter((item) => getParamCategory(item) === 'business').length, tone: 'success' },
  { label: '接口变量', value: params.value.filter((item) => getParamCategory(item) === 'api').length, tone: 'purple' },
  { label: 'Web UI变量', value: params.value.filter((item) => getParamCategory(item) === 'webUi').length, tone: 'warning' },
  { label: 'APP UI变量', value: params.value.filter((item) => getParamCategory(item) === 'appUi').length, tone: 'warning' },
])

const categoryTabs: Array<{ label: string; value: ParamCategoryFilter }> = [
  { label: '全部', value: '' },
  { label: '通用业务', value: 'business' },
  { label: '接口变量', value: 'api' },
  { label: 'Web UI', value: 'webUi' },
  { label: 'APP UI', value: 'appUi' },
  { label: '全局公共', value: 'global' },
]

const paramQuery = computed(() => ({
  keyword: filterKeyword.value.trim(),
  status: filterStatus.value === '' ? undefined : (Number(filterStatus.value) as ConfigStatus),
}))

const detailVariableRows = computed(() => {
  const keyword = detailKeyword.value.trim().toLowerCase()
  return detailForm.variables
    .map((variable, index) => ({ variable, index }))
    .filter(({ variable }) => {
      if (!keyword) {
        return true
      }
      return `${variable.name} ${variable.value} ${variable.description}`.toLowerCase().includes(keyword)
    })
})

const debouncedLoadParams = debounce(() => {
  void loadParams()
}, 300)

function resetFilters() {
  suppressFilterLoad = true
  filterKeyword.value = ''
  filterStatus.value = ''
  activeCategory.value = ''
  suppressFilterLoad = false
  void loadParams()
}

async function loadParams() {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsParams(props.workspaceCode, paramQuery.value)
    params.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingParam.value = null
  dialogVisible.value = true
}

function openEditDialog(param: ParamSetItem) {
  openDetail(param)
}

function openDetail(param: ParamSetItem) {
  detailParam.value = param
  Object.assign(detailForm, createConfigParamFormFromItem(param))
  detailKeyword.value = ''
  detailError.value = ''
}

function closeDetail() {
  detailParam.value = null
  detailKeyword.value = ''
  detailError.value = ''
}

function addDetailVariable() {
  detailForm.variables.push(createDefaultWebUiVariable())
}

function removeDetailVariable(index: number) {
  detailForm.variables.splice(index, 1)
  if (detailForm.variables.length === 0) {
    addDetailVariable()
  }
}

async function importDetailVariablesFromJson() {
  const input = window.prompt('请输入变量 JSON 数组，例如：[{"name":"USERNAME","value":"admin","sensitive":false,"description":"登录账号"}]')
  if (input === null) {
    return
  }
  const variables = parseWebUiVariables(input)
  if (variables.length === 0) {
    detailError.value = '未识别到有效变量，请检查 JSON 格式'
    return
  }
  detailForm.variables.splice(0, detailForm.variables.length, ...variables)
  detailError.value = ''
  ElMessage.success(`已导入 ${variables.length} 个变量`)
}

async function exportDetailVariablesToJson() {
  const text = JSON.stringify(
    detailForm.variables
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
    detailError.value = text
  }
}

async function saveDetail() {
  if (!detailParam.value) {
    return
  }
  const error = validateDetailForm()
  if (error) {
    detailError.value = error
    return
  }
  saving.value = true
  try {
    const nextParam = await configApi.updateSettingsParam(props.workspaceCode, detailParam.value.id, buildCreateParamPayload(detailForm))
    detailParam.value = nextParam
    Object.assign(detailForm, createConfigParamFormFromItem(nextParam))
    detailError.value = ''
    ElMessage.success('变量集已保存')
    await loadParams()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function validateDetailForm() {
  if (!detailForm.paramName.trim()) {
    return '请输入变量集名称'
  }
  const activeVariables = detailForm.variables.filter(variable => variable.name.trim() || variable.value.trim())
  if (activeVariables.length === 0) {
    return '请至少添加一个变量'
  }
  const names = new Set<string>()
  for (const variable of activeVariables) {
    const name = variable.name.trim()
    if (!name) {
      return '变量名不能为空'
    }
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
      return `变量名 ${name} 只能包含字母、数字、下划线、点和中划线，且不能以数字开头`
    }
    const upperName = name.toUpperCase()
    if (names.has(upperName)) {
      return `变量名 ${name} 重复`
    }
    names.add(upperName)
  }
  return ''
}

async function submitParam(payload: CreateParamPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingParam.value) {
      await configApi.updateSettingsParam(props.workspaceCode, editingParam.value.id, payload)
      ElMessage.success('变量集/参数已更新')
    } else {
      await configApi.createSettingsParam(props.workspaceCode, payload)
      ElMessage.success('变量集/参数已创建')
    }
    dialogVisible.value = false
    await loadParams()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeParam(param: ParamSetItem) {
  deletingParamId.value = param.id
  try {
    await deleteConfigParam(param, props.workspaceCode)
    ElMessage.success('变量集/参数已删除')
    await loadParams()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingParamId.value = null
  }
}

async function openReferenceDrawer(param: ParamSetItem) {
  referenceDrawerVisible.value = true
  referenceLoading.value = true
  referenceSummary.value = null
  try {
    referenceSummary.value = await configApi.getSettingsParamReferences(props.workspaceCode, param.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

async function openChangeHistoryDrawer(param: ParamSetItem) {
  changeHistoryDrawerVisible.value = true
  changeHistoryLoading.value = true
  changeHistoryItems.value = []
  try {
    const page = await configApi.getSettingsParamChangeHistory(props.workspaceCode, param.id)
    changeHistoryItems.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    changeHistoryLoading.value = false
  }
}

async function loadVersions(param: ParamSetItem) {
  versionLoading.value = true
  versionItems.value = []
  try {
    const page = await configApi.getSettingsParamVersions(props.workspaceCode, param.id)
    versionItems.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    versionLoading.value = false
  }
}

async function openVersionDrawer(param: ParamSetItem) {
  versionParam.value = param
  versionDrawerVisible.value = true
  await loadVersions(param)
}

async function rollbackVersion(version: ParamSetVersionItem) {
  if (!versionParam.value || version.latest) return
  const latestVersion = versionItems.value.find(item => item.latest) || versionItems.value[0]
  const nextVersionNo = (latestVersion?.versionNo || 0) + 1
  try {
    await ElMessageBox.confirm(
      `确认将变量集从 v${latestVersion?.versionNo || '-'} 回滚到 v${version.versionNo}？回滚后会生成 v${nextVersionNo}。\n\n目标版本：${version.paramName || '-'}\n状态：${version.status === 0 ? '停用' : '启用'}\n变更字段：${version.changedFields || '-'}`,
      '回滚变量集版本',
      {
        confirmButtonText: '确认回滚',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  rollbackingVersionId.value = version.id
  try {
    await configApi.rollbackSettingsParamVersion(props.workspaceCode, versionParam.value.id, version.id)
    ElMessage.success('变量集版本已回滚')
    await Promise.all([loadParams(), loadVersions(versionParam.value)])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    rollbackingVersionId.value = null
  }
}

onMounted(() => {
  void loadParams()
})

onBeforeUnmount(() => {
  debouncedLoadParams.cancel()
})

watch(
  () => props.workspaceCode,
  () => {
    debouncedLoadParams.cancel()
    void loadParams()
  },
)

watch([filterKeyword, filterStatus, activeCategory], () => {
  if (suppressFilterLoad) {
    return
  }
  debouncedLoadParams()
}, { flush: 'sync' })
</script>

<template>
  <section class="config-panel">
    <header class="config-panel__header">
      <div>
        <h2>变量集</h2>
        <p>管理接口、Web UI 和业务运行时变量。</p>
      </div>
      <div class="config-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadParams">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集</AppButton>
      </div>
    </header>

    <div class="config-panel__stats config-panel__stats--four">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <div v-if="!errorMessage" class="config-filter-toolbar">
      <el-input
        v-model="filterKeyword"
        class="config-filter-control config-filter-control--search"
        clearable
        placeholder="搜索名称 / 变量值 / 说明"
        :prefix-icon="Search"
      />
      <el-select
        v-model="filterStatus"
        class="config-filter-control"
        clearable
        placeholder="状态"
      >
        <el-option
          v-for="item in configStatusOptions"
          :key="item.value"
          :label="item.label"
          :value="String(item.value)"
        />
      </el-select>
      <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
    </div>

    <div v-else-if="params.length" class="config-inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadParams">重试</AppButton>
    </div>

    <div class="config-segmented-tabs">
      <button
        v-for="item in categoryTabs"
        :key="item.label"
        type="button"
        :class="{ 'is-active': activeCategory === item.value }"
        @click="activeCategory = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <AppLoadingState v-if="loading && !params.length" text="正在加载变量集..." />

    <AppEmptyState
      v-else-if="errorMessage && !params.length"
      title="变量集加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadParams">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="config-param-table-card">
      <table v-if="filteredParams.length">
        <colgroup>
          <col class="config-param-table-card__name-col" />
          <col class="config-param-table-card__value-col" />
          <col class="config-param-table-card__type-col" />
          <col class="config-param-table-card__description-col" />
          <col class="config-param-table-card__action-col" />
        </colgroup>
        <thead>
          <tr>
            <th>名称</th>
            <th>值 / 变量数</th>
            <th>类型</th>
            <th>说明</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="param in filteredParams" :key="param.id">
            <td>
              <div class="config-table-title">{{ param.paramName }}</div>
              <div class="config-table-subtitle">{{ param.workspaceName || param.workspaceCode }}</div>
            </td>
            <td>
              <span class="config-value-chip" :title="getParamValueText(param)">
                {{ getParamValueText(param) }}
              </span>
            </td>
            <td>
              <ConfigTypeBadge
                :label="getParamTypeMeta(param).label"
                :tone="getParamTypeMeta(param).tone"
              />
            </td>
            <td>
              <span class="config-table-muted">{{ getParamDescriptionText(param) }}</span>
            </td>
            <td>
              <button
                type="button"
                class="config-text-action"
                :disabled="deletingParamId === param.id"
                @click="openEditDialog(param)"
              >
                编辑
              </button>
              <button
                type="button"
                class="config-text-action"
                :disabled="deletingParamId === param.id"
                @click="openReferenceDrawer(param)"
              >
                <el-icon><Connection /></el-icon>
                引用
              </button>
              <el-dropdown trigger="click" @command="(command: string) => {
                if (command === 'history') openChangeHistoryDrawer(param)
                if (command === 'version') openVersionDrawer(param)
                if (command === 'delete') removeParam(param)
              }">
                <button type="button" class="config-more-action" :disabled="deletingParamId === param.id">
                  <el-icon><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="history">变更历史</el-dropdown-item>
                    <el-dropdown-item command="version">版本</el-dropdown-item>
                    <el-dropdown-item command="delete" class="is-danger">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </td>
          </tr>
        </tbody>
      </table>

      <AppEmptyState
        v-else
        title="暂无变量集"
        description="当前筛选条件下没有变量集或参数。"
      >
        <template #actions>
          <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集</AppButton>
        </template>
      </AppEmptyState>
    </div>

    <el-drawer
      :model-value="!!detailParam"
      title="编辑变量集"
      size="760px"
      class="config-param-drawer"
      @update:model-value="(value: boolean) => { if (!value) closeDetail() }"
    >
    <div v-if="detailParam" class="config-param-detail">
      <div class="config-param-detail__top">
        <div class="config-param-detail__main-fields">
          <label>
            <span>变量集名称</span>
            <el-input v-model="detailForm.paramName" placeholder="例如：微信沙箱支付变量集" />
          </label>
          <label>
            <span>变量集类型</span>
            <el-select v-model="detailForm.paramType" placeholder="请选择类型">
              <el-option
                v-for="item in configParamTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </label>
          <label>
            <span>状态</span>
            <el-select v-model="detailForm.status">
              <el-option
                v-for="item in configStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </label>
        </div>
        <div class="config-param-detail__meta">
          <span>{{ detailParam.workspaceName || detailParam.workspaceCode }}</span>
          <span>ID {{ detailParam.id }}</span>
          <button type="button" class="config-text-action" @click="openReferenceDrawer(detailParam)">引用详情</button>
          <button type="button" class="config-text-action" @click="openChangeHistoryDrawer(detailParam)">变更历史</button>
        </div>
      </div>

      <div v-if="detailError" class="config-inline-error">
        {{ detailError }}
      </div>

      <div class="config-param-detail__toolbar">
        <el-input
          v-model="detailKeyword"
          class="config-filter-control config-filter-control--search"
          clearable
          placeholder="搜索变量名 / 值 / 说明"
          :prefix-icon="Search"
        />
        <div class="config-param-detail__toolbar-actions">
          <AppButton @click="importDetailVariablesFromJson">JSON 导入</AppButton>
          <AppButton @click="exportDetailVariablesToJson">JSON 导出</AppButton>
          <AppButton type="primary" :icon="Plus" @click="addDetailVariable">新增变量</AppButton>
        </div>
      </div>

      <el-table class="config-param-detail__table" :data="detailVariableRows" border>
        <el-table-column label="变量名" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.variable.name" placeholder="变量名" />
          </template>
        </el-table-column>
        <el-table-column label="变量值" min-width="240">
          <template #default="{ row }">
            <el-input
              v-model="row.variable.value"
              :type="row.variable.sensitive ? 'password' : 'text'"
              placeholder="变量值"
              show-password
            />
          </template>
        </el-table-column>
        <el-table-column label="敏感" width="92" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.variable.sensitive" />
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="220">
          <template #default="{ row }">
            <el-input v-model="row.variable.description" placeholder="用途说明" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="92" align="center">
          <template #default="{ row }">
            <el-button type="danger" link @click="removeDetailVariable(row.index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
      <template #footer>
        <AppButton :disabled="saving" @click="closeDetail">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="saveDetail">保存</AppButton>
      </template>
    </el-drawer>

    <ConfigParamDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :param="editingParam"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitParam"
    />
    <ConfigReferenceDrawer
      v-model="referenceDrawerVisible"
      title="变量集引用详情"
      :loading="referenceLoading"
      :summary="referenceSummary"
    />
    <ConfigParamChangeHistoryDrawer
      v-model="changeHistoryDrawerVisible"
      :loading="changeHistoryLoading"
      :items="changeHistoryItems"
    />
    <ConfigParamVersionDrawer
      v-model="versionDrawerVisible"
      :loading="versionLoading"
      :items="versionItems"
      :rollbacking-id="rollbackingVersionId"
      @rollback="rollbackVersion"
    />
  </section>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.config-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.config-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-panel__stats {
  display: grid;
  gap: var(--app-space-4);
}

.config-panel__stats--five {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.config-panel__stats--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.config-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-3);
}

.config-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.config-filter-control {
  width: 156px;
}

.config-filter-control--search {
  width: min(340px, 100%);
}

.config-segmented-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.config-segmented-tabs button {
  min-height: var(--app-control-height-sm);
  padding: 0 var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-main);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-segmented-tabs button:hover {
  background: var(--app-bg-page);
}

.config-segmented-tabs button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.config-param-table-card {
  overflow: hidden;
  min-height: 120px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-param-detail {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  min-height: 360px;
  padding: 0;
}

.config-param-drawer :deep(.el-drawer__body) {
  padding: var(--app-space-5);
}

.config-param-drawer :deep(.el-drawer__footer) {
  padding: var(--app-space-4) var(--app-space-5);
  border-top: 1px solid var(--app-border);
}

.config-param-detail__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-param-detail__main-fields {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(260px, 1.5fr) minmax(180px, 1fr) minmax(140px, 0.6fr);
  gap: var(--app-space-3);
}

.config-param-detail__main-fields label {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-param-detail__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-3);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.config-param-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.config-param-detail__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-param-detail__table {
  width: 100%;
}

.config-param-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-param-table-card__name-col {
  width: 22%;
}

.config-param-table-card__value-col {
  width: 28%;
}

.config-param-table-card__type-col {
  width: 16%;
}

.config-param-table-card__description-col {
  width: 22%;
}

.config-param-table-card__action-col {
  width: 112px;
}

.config-param-table-card thead {
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-page);
}

.config-param-table-card th {
  padding: var(--app-space-3) var(--app-space-6);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  text-align: left;
}

.config-param-table-card td {
  padding: var(--app-space-4) var(--app-space-6);
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  vertical-align: middle;
}

.config-param-table-card tr:last-child td {
  border-bottom: 0;
}

.config-table-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-table-subtitle,
.config-table-muted {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-value-chip {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: var(--app-space-1) var(--app-space-2);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-text-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: var(--app-space-3);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
}

.config-text-action.is-danger {
  color: var(--app-danger);
}

.config-text-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.config-more-action {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.config-more-action:hover {
  background: var(--app-bg-page);
  color: var(--app-text-main);
}

.config-more-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 1100px) {
  .config-panel__stats--four,
  .config-panel__stats--five {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .config-param-detail__top,
  .config-param-detail__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .config-param-detail__main-fields {
    grid-template-columns: 1fr;
  }

  .config-param-detail__meta,
  .config-param-detail__toolbar-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .config-panel__stats--four,
  .config-panel__stats--five {
    grid-template-columns: 1fr;
  }

  .config-panel__header {
    flex-direction: column;
  }

  .config-panel__actions {
    justify-content: flex-start;
  }

  .config-filter-toolbar,
  .config-filter-control,
  .config-filter-control--search {
    width: 100%;
  }
}
</style>
