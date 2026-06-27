<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Connection, MoreFilled, Plus, RefreshRight, Search, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  ConfigStatCard,
  ConfigTypeBadge,
  configApi,
  configEnvTypeOptions,
  configStatusOptions,
  getEnvBuiltInVariableHints,
  getEnvDefaultVariableSetId,
  getEnvMockApplicationId,
  getEnvServiceSummary,
  getEnvTimeoutMs,
  getEnvVisualMeta,
  isProductionEnv,
  type ConfigStat,
  type ConfigStatus,
  type ConfigReferenceSummary,
  type CreateEnvPayload,
  type EnvConfigItem,
  type MockApplicationItem,
  type ParamSetItem,
} from '@/entities/config'
import { ConfigEnvDialog, type ConfigEnvDialogMode } from '@/features/config-env-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
import ConfigReferenceDrawer from '@/widgets/config-reference-drawer/ConfigReferenceDrawer.vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const envs = ref<EnvConfigItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const dialogMode = ref<ConfigEnvDialogMode>('create')
const editingEnv = ref<EnvConfigItem | null>(null)
const deletingEnvId = ref<number | null>(null)
const togglingEnvId = ref<number | null>(null)
const filterKeyword = ref('')
const filterEnvType = ref('')
const filterStatus = ref('')
let suppressFilterLoad = false

const stats = computed<ConfigStat[]>(() => [
  { label: '环境总数', value: envs.value.length, tone: 'primary' },
  { label: '启用环境', value: envs.value.filter((item) => item.status === 1).length, tone: 'success' },
  { label: '生产环境', value: envs.value.filter((item) => isProductionEnv(item)).length, tone: 'danger' },
])

const filteredEnvs = computed(() => {
  return envs.value
})

const envQuery = computed(() => ({
  keyword: filterKeyword.value.trim(),
  envType: filterEnvType.value,
  status: filterStatus.value === '' ? undefined : (Number(filterStatus.value) as ConfigStatus),
}))

const debouncedLoadEnvs = debounce(() => {
  void loadEnvs()
}, 300)

async function loadEnvs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [page, variableSetPage, mockApplicationPage] = await Promise.all([
      configApi.getSettingsEnvs(props.workspaceCode, envQuery.value),
      configApi.getSettingsParams(props.workspaceCode, { status: 1 }),
      configApi.getMockApplications(props.workspaceCode, { status: 1 }),
    ])
    envs.value = Array.isArray(page.items) ? page.items : []
    variableSets.value = Array.isArray(variableSetPage.items) ? variableSetPage.items : []
    mockApplications.value = Array.isArray(mockApplicationPage.items) ? mockApplicationPage.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  suppressFilterLoad = true
  filterKeyword.value = ''
  filterEnvType.value = ''
  filterStatus.value = ''
  suppressFilterLoad = false
  void loadEnvs()
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingEnv.value = null
  dialogVisible.value = true
}

function openEditDialog(env: EnvConfigItem) {
  dialogMode.value = 'edit'
  editingEnv.value = env
  dialogVisible.value = true
}

async function submitEnv(payload: CreateEnvPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingEnv.value) {
      await configApi.updateSettingsEnv(props.workspaceCode, editingEnv.value.id, payload)
      ElMessage.success('环境配置已更新')
    } else {
      await configApi.createSettingsEnv(props.workspaceCode, payload)
      ElMessage.success('环境配置已创建')
    }
    dialogVisible.value = false
    await loadEnvs()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeEnv(env: EnvConfigItem) {
  deletingEnvId.value = env.id
  try {
    await deleteConfigEnv(env, props.workspaceCode)
    ElMessage.success('环境配置已删除')
    await loadEnvs()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      const message = getRequestErrorMessage(error)
      if (message.includes('引用')) {
        ElMessage.warning('该环境已被引用，已为你打开引用详情')
        await openReferenceDrawer(env)
      } else {
        ElMessage.error(message)
      }
    }
  } finally {
    deletingEnvId.value = null
  }
}

async function switchEnvStatus(env: EnvConfigItem) {
  togglingEnvId.value = env.id
  try {
    const nextStatus = await toggleConfigEnvStatus(env, props.workspaceCode)
    ElMessage.success(nextStatus === 1 ? '环境已启用' : '环境已禁用')
    await loadEnvs()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    togglingEnvId.value = null
  }
}

async function openReferenceDrawer(env: EnvConfigItem) {
  referenceDrawerVisible.value = true
  referenceLoading.value = true
  referenceSummary.value = null
  try {
    referenceSummary.value = await configApi.getSettingsEnvReferences(props.workspaceCode, env.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

function isEnvOperating(env: EnvConfigItem) {
  return deletingEnvId.value === env.id || togglingEnvId.value === env.id
}

function findEnvDefaultVariableSet(env: EnvConfigItem) {
  const id = getEnvDefaultVariableSetId(env)
  return id == null ? null : variableSets.value.find(item => item.id === id) || null
}

function findEnvMockApplication(env: EnvConfigItem) {
  const id = getEnvMockApplicationId(env)
  return id == null ? null : mockApplications.value.find(item => item.id === id) || null
}

function formatEnvTimeout(env: EnvConfigItem) {
  const timeoutMs = getEnvTimeoutMs(env)
  return timeoutMs == null ? '-' : `${timeoutMs} ms`
}

function formatEnvBuiltInVariables(env: EnvConfigItem) {
  return getEnvBuiltInVariableHints(env).join('、')
}

onMounted(() => {
  void loadEnvs()
})

onBeforeUnmount(() => {
  debouncedLoadEnvs.cancel()
})

watch(
  () => props.workspaceCode,
  () => {
    debouncedLoadEnvs.cancel()
    void loadEnvs()
  },
)

watch([filterKeyword, filterEnvType, filterStatus], () => {
  if (suppressFilterLoad) {
    return
  }
  debouncedLoadEnvs()
}, { flush: 'sync' })
</script>

<template>
  <section class="config-panel">
    <header class="config-panel__header">
      <div>
        <h2>环境配置</h2>
        <p>管理不同测试环境的配置信息。</p>
      </div>
      <div class="config-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadEnvs">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增环境</AppButton>
      </div>
    </header>

    <div class="config-panel__stats config-panel__stats--three">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <div v-if="!errorMessage" class="config-filter-toolbar">
      <el-input
        v-model="filterKeyword"
        class="config-filter-control config-filter-control--search"
        clearable
        placeholder="搜索环境名称 / Base URL"
        :prefix-icon="Search"
      />
      <el-select
        v-model="filterEnvType"
        class="config-filter-control"
        clearable
        placeholder="环境分组"
      >
        <el-option
          v-for="item in configEnvTypeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
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

    <div v-else-if="envs.length" class="config-inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadEnvs">重试</AppButton>
    </div>

    <AppLoadingState v-if="loading && !envs.length" text="正在加载环境配置..." />

    <AppEmptyState
      v-else-if="errorMessage && !envs.length"
      title="环境配置加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadEnvs">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="filteredEnvs.length" class="config-env-table-card">
      <table>
        <colgroup>
          <col class="config-env-table-card__name-col" />
          <col class="config-env-table-card__type-col" />
          <col class="config-env-table-card__service-col" />
          <col class="config-env-table-card__variable-col" />
          <col class="config-env-table-card__mock-col" />
          <col class="config-env-table-card__policy-col" />
          <col class="config-env-table-card__status-col" />
          <col class="config-env-table-card__action-col" />
        </colgroup>
        <thead>
          <tr>
            <th>环境名称</th>
            <th>环境类型</th>
            <th>默认服务</th>
            <th>默认变量集</th>
            <th>默认 Mock 应用</th>
            <th>超时(ms)</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="env in filteredEnvs" :key="env.id">
            <td>
              <div class="config-table-title">{{ env.envName }}</div>
              <span class="config-table-subtitle">{{ env.workspaceName || env.workspaceCode }}</span>
              <span class="config-env-description">{{ getEnvVisualMeta(env).description }}</span>
            </td>
            <td>
              <ConfigTypeBadge
                :label="getEnvVisualMeta(env).typeLabel"
                :tone="getEnvVisualMeta(env).tone"
              />
            </td>
            <td>
              <div class="config-env-service-cell">
                <span>{{ getEnvServiceSummary(env).defaultLabel }}</span>
                <code>{{ getEnvServiceSummary(env).defaultBaseUrl || env.baseUrl || '-' }}</code>
              </div>
            </td>
            <td>
              <span class="config-table-muted">{{ findEnvDefaultVariableSet(env)?.paramName || '未绑定' }}</span>
            </td>
            <td>
              <span class="config-table-muted">{{ findEnvMockApplication(env)?.appName || '未绑定' }}</span>
            </td>
            <td>
              <span class="config-table-muted" :title="formatEnvBuiltInVariables(env)">{{ formatEnvTimeout(env).replace('ms', '') }}</span>
            </td>
            <td>
              <ConfigTypeBadge
                :label="env.status === 1 ? '启用中' : '已停用'"
                :tone="env.status === 1 ? 'success' : 'default'"
              />
            </td>
            <td>
              <button
                type="button"
                class="config-text-action"
                :disabled="isEnvOperating(env)"
                @click="openEditDialog(env)"
              >
                编辑
              </button>
              <button
                type="button"
                class="config-text-action"
                :disabled="isEnvOperating(env)"
                @click="openReferenceDrawer(env)"
              >
                <el-icon><Connection /></el-icon>
                引用
              </button>
              <el-dropdown trigger="click" @command="(command: string) => command === 'toggle' ? switchEnvStatus(env) : removeEnv(env)">
                <button type="button" class="config-more-action" :disabled="isEnvOperating(env)">
                  <el-icon><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="toggle">
                      <el-icon><Switch /></el-icon>
                      {{ env.status === 1 ? '停用' : '启用' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" class="is-danger">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppEmptyState
      v-else
      title="暂无环境配置"
      :description="envs.length ? '当前筛选条件下没有环境配置。' : '当前空间还没有环境配置。'"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增环境</AppButton>
      </template>
    </AppEmptyState>

    <ConfigEnvDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :env="editingEnv"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitEnv"
    />
    <ConfigReferenceDrawer
      v-model="referenceDrawerVisible"
      title="环境引用详情"
      :loading="referenceLoading"
      :summary="referenceSummary"
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

.config-panel__stats--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  width: min(320px, 100%);
}

.config-env-table-card {
  overflow: hidden;
  min-height: 120px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-env-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-env-table-card__name-col {
  width: 18%;
}

.config-env-table-card__type-col {
  width: 112px;
}

.config-env-table-card__service-col {
  width: 22%;
}

.config-env-table-card__variable-col {
  width: 15%;
}

.config-env-table-card__mock-col {
  width: 15%;
}

.config-env-table-card__policy-col {
  width: 96px;
}

.config-env-table-card__status-col {
  width: 90px;
}

.config-env-table-card__action-col {
  width: 150px;
}

.config-env-table-card thead {
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-page);
}

.config-env-table-card th {
  padding: var(--app-space-3) var(--app-space-5);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  text-align: left;
}

.config-env-table-card td {
  padding: var(--app-space-4) var(--app-space-5);
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  vertical-align: middle;
}

.config-env-table-card tr:last-child td {
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
.config-env-description {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-env-service-cell,
.config-env-policy-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.config-env-service-cell span,
.config-env-policy-cell span,
.config-env-service-cell em {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-env-service-cell span {
  color: var(--app-text-main);
  font-weight: 600;
}

.config-env-service-cell code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-text-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: var(--app-space-2);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
}

.config-text-action:hover {
  color: var(--app-primary-hover);
}

.config-text-action.is-danger {
  color: var(--app-danger);
}

.config-text-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
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
  opacity: 0.48;
}

@media (max-width: 900px) {
  .config-panel__stats--three {
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

  .config-env-table-card {
    overflow-x: auto;
  }

  .config-env-table-card table {
    min-width: 1040px;
  }
}
</style>
