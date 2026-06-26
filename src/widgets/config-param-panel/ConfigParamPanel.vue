<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Connection, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  ConfigStatCard,
  ConfigTypeBadge,
  configApi,
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
import { ConfigParamDialog, type ConfigParamDialogMode } from '@/features/config-param-create-edit'
import { deleteConfigParam } from '@/features/config-param-delete'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
import ConfigParamChangeHistoryDrawer from '@/widgets/config-param-change-history-drawer/ConfigParamChangeHistoryDrawer.vue'
import ConfigParamVersionDrawer from '@/widgets/config-param-version-drawer/ConfigParamVersionDrawer.vue'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type ParamCategoryFilter = '' | 'global' | 'api' | 'business' | 'webUi'

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
let suppressFilterLoad = false

const filteredParams = computed(() => {
  if (!activeCategory.value) {
    return params.value
  }
  return params.value.filter(item => getParamCategory(item) === activeCategory.value)
})

const stats = computed<ConfigStat[]>(() => [
  { label: '全部参数', value: params.value.length },
  { label: '全局参数', value: params.value.filter((item) => getParamCategory(item) === 'global').length, tone: 'primary' },
  { label: '接口变量', value: params.value.filter((item) => getParamCategory(item) === 'api').length, tone: 'purple' },
  { label: '业务参数', value: params.value.filter((item) => getParamCategory(item) === 'business').length, tone: 'success' },
  { label: 'Web UI 变量集', value: params.value.filter((item) => getParamCategory(item) === 'webUi').length, tone: 'warning' },
])

const categoryTabs: Array<{ label: string; value: ParamCategoryFilter }> = [
  { label: '全部', value: '' },
  { label: '全局参数', value: 'global' },
  { label: '接口变量', value: 'api' },
  { label: '业务参数', value: 'business' },
  { label: 'Web UI 变量集', value: 'webUi' },
]

const paramQuery = computed(() => ({
  keyword: filterKeyword.value.trim(),
  status: filterStatus.value === '' ? undefined : (Number(filterStatus.value) as ConfigStatus),
}))

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
  dialogMode.value = 'edit'
  editingParam.value = param
  dialogVisible.value = true
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
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集/参数</AppButton>
      </div>
    </header>

    <div class="config-panel__stats config-panel__stats--five">
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
                @click="openReferenceDrawer(param)"
              >
                <el-icon><Connection /></el-icon>
                引用
              </button>
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
                @click="openChangeHistoryDrawer(param)"
              >
                变更
              </button>
              <button
                type="button"
                class="config-text-action"
                :disabled="deletingParamId === param.id"
                @click="openVersionDrawer(param)"
              >
                版本
              </button>
              <button
                type="button"
                class="config-text-action is-danger"
                :disabled="deletingParamId === param.id"
                @click="removeParam(param)"
              >
                删除
              </button>
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
          <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增变量集/参数</AppButton>
        </template>
      </AppEmptyState>
    </div>

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

@media (max-width: 1100px) {
  .config-panel__stats--five {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
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
