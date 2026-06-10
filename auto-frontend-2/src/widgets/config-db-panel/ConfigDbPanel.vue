<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Connection, Delete, Edit, Plus, RefreshRight, Search, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  ConfigStatCard,
  ConfigTypeBadge,
  configApi,
  configDbTypeOptions,
  configStatusOptions,
  getDbHostSummary,
  getDbNameSummary,
  type ConfigStat,
  type ConfigStatus,
  type CreateDbConnectionPayload,
  type DbConnectionItem,
} from '@/entities/config'
import { ConfigDbDialog, type ConfigDbDialogMode } from '@/features/config-db-create-edit'
import { deleteConfigDbConnection } from '@/features/config-db-delete'
import { testConfigDbConnection } from '@/features/config-db-test-connection'
import { toggleConfigDbConnectionStatus } from '@/features/config-db-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
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

const dbConnections = ref<DbConnectionItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const dialogMode = ref<ConfigDbDialogMode>('create')
const editingDbConnection = ref<DbConnectionItem | null>(null)
const testingDbConnectionId = ref<number | null>(null)
const deletingDbConnectionId = ref<number | null>(null)
const togglingDbConnectionId = ref<number | null>(null)
const filterKeyword = ref('')
const filterDbType = ref('')
const filterStatus = ref('')
let suppressFilterLoad = false

const stats = computed<ConfigStat[]>(() => [
  { label: '连接总数', value: dbConnections.value.length, tone: 'primary' },
  { label: '正常连接', value: dbConnections.value.filter((item) => item.status === 1).length, tone: 'success' },
  { label: '异常连接', value: dbConnections.value.filter((item) => item.status !== 1).length, tone: 'danger' },
  { label: 'MySQL', value: dbConnections.value.filter((item) => item.dbType === 'MYSQL').length, tone: 'warning' },
])

const filteredDbConnections = computed(() => {
  return dbConnections.value
})

const dbConnectionQuery = computed(() => ({
  keyword: filterKeyword.value.trim(),
  dbType: filterDbType.value,
  status: filterStatus.value === '' ? undefined : (Number(filterStatus.value) as ConfigStatus),
}))

const debouncedLoadDbConnections = debounce(() => {
  void loadDbConnections()
}, 300)

async function loadDbConnections() {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsDbConnections(props.workspaceCode, dbConnectionQuery.value)
    dbConnections.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  suppressFilterLoad = true
  filterKeyword.value = ''
  filterDbType.value = ''
  filterStatus.value = ''
  suppressFilterLoad = false
  void loadDbConnections()
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingDbConnection.value = null
  dialogVisible.value = true
}

function openEditDialog(dbConnection: DbConnectionItem) {
  dialogMode.value = 'edit'
  editingDbConnection.value = dbConnection
  dialogVisible.value = true
}

async function submitDbConnection(payload: CreateDbConnectionPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingDbConnection.value) {
      await configApi.updateSettingsDbConnection(props.workspaceCode, editingDbConnection.value.id, payload)
      ElMessage.success('数据库连接已更新')
    } else {
      await configApi.createSettingsDbConnection(props.workspaceCode, payload)
      ElMessage.success('数据库连接已创建')
    }
    dialogVisible.value = false
    await loadDbConnections()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function testConnection(dbConnection: DbConnectionItem) {
  testingDbConnectionId.value = dbConnection.id
  try {
    const result = await testConfigDbConnection(dbConnection, props.workspaceCode)
    if (result?.success === false) {
      ElMessage.error(result.message || '数据库连接测试失败')
      return
    }

    const suffix = result?.elapsedMs ? `，耗时 ${result.elapsedMs}ms` : ''
    ElMessage.success(result?.message || `数据库连接测试成功${suffix}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    testingDbConnectionId.value = null
  }
}

async function removeDbConnection(dbConnection: DbConnectionItem) {
  deletingDbConnectionId.value = dbConnection.id
  try {
    await deleteConfigDbConnection(dbConnection, props.workspaceCode)
    ElMessage.success('数据库连接已删除')
    await loadDbConnections()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingDbConnectionId.value = null
  }
}

async function switchDbConnectionStatus(dbConnection: DbConnectionItem) {
  togglingDbConnectionId.value = dbConnection.id
  try {
    const nextStatus = await toggleConfigDbConnectionStatus(dbConnection, props.workspaceCode)
    ElMessage.success(nextStatus === 1 ? '数据库连接已启用' : '数据库连接已禁用')
    await loadDbConnections()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    togglingDbConnectionId.value = null
  }
}

onMounted(() => {
  void loadDbConnections()
})

onBeforeUnmount(() => {
  debouncedLoadDbConnections.cancel()
})

watch(
  () => props.workspaceCode,
  () => {
    debouncedLoadDbConnections.cancel()
    void loadDbConnections()
  },
)

watch([filterKeyword, filterDbType, filterStatus], () => {
  if (suppressFilterLoad) {
    return
  }
  debouncedLoadDbConnections()
}, { flush: 'sync' })
</script>

<template>
  <section class="config-panel">
    <header class="config-panel__header">
      <div>
        <h2>数据库连接</h2>
        <p>管理测试数据库连接配置。</p>
      </div>
      <div class="config-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadDbConnections">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增连接</AppButton>
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
        placeholder="搜索连接名 / Host / 数据库"
        :prefix-icon="Search"
      />
      <el-select
        v-model="filterDbType"
        class="config-filter-control"
        clearable
        placeholder="数据库类型"
      >
        <el-option
          v-for="item in configDbTypeOptions"
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

    <div v-else-if="dbConnections.length" class="config-inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadDbConnections">重试</AppButton>
    </div>

    <AppLoadingState v-if="loading && !dbConnections.length" text="正在加载数据库连接..." />

    <AppEmptyState
      v-else-if="errorMessage && !dbConnections.length"
      title="数据库连接加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadDbConnections">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="filteredDbConnections.length" class="config-db-list">
      <article v-for="db in filteredDbConnections" :key="db.id" class="config-db-card">
        <div class="config-db-card__main">
          <div class="config-db-card__title">
            <div class="config-db-card__name-row">
              <h3>{{ db.connectionName }}</h3>
              <ConfigTypeBadge
                :label="db.status === 1 ? '连接正常' : '连接异常'"
                :tone="db.status === 1 ? 'success' : 'danger'"
              />
            </div>
            <div class="config-db-card__meta-row">
              <ConfigTypeBadge :label="db.dbType" tone="primary" />
              <span>{{ getDbHostSummary(db.jdbcUrl) }}</span>
              <span>数据库：{{ getDbNameSummary(db) }}</span>
            </div>
            <p>所属空间：{{ db.workspaceName || db.workspaceCode }}</p>
          </div>
          <div class="config-db-card__actions">
            <button
              type="button"
              class="config-db-card__icon-button"
              aria-label="测试连接"
              :disabled="testingDbConnectionId === db.id"
              @click="testConnection(db)"
            >
              <el-icon><Connection /></el-icon>
            </button>
            <button
              type="button"
              class="config-db-card__icon-button"
              :aria-label="db.status === 1 ? '禁用连接' : '启用连接'"
              :disabled="togglingDbConnectionId === db.id"
              @click="switchDbConnectionStatus(db)"
            >
              <el-icon><Switch /></el-icon>
            </button>
            <button
              type="button"
              class="config-db-card__icon-button"
              aria-label="编辑连接"
              @click="openEditDialog(db)"
            >
              <el-icon><Edit /></el-icon>
            </button>
            <button
              type="button"
              class="config-db-card__icon-button is-danger"
              aria-label="删除连接"
              :disabled="deletingDbConnectionId === db.id"
              @click="removeDbConnection(db)"
            >
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </div>
      </article>
    </div>

    <AppEmptyState
      v-else
      title="暂无数据库连接"
      :description="dbConnections.length ? '当前筛选条件下没有数据库连接配置。' : '当前空间还没有数据库连接配置。'"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增连接</AppButton>
      </template>
    </AppEmptyState>

    <ConfigDbDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :db-connection="editingDbConnection"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitDbConnection"
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

.config-db-list {
  display: grid;
  gap: var(--app-space-4);
}

.config-db-card {
  padding: var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  transition: box-shadow 160ms ease;
}

.config-db-card:hover {
  box-shadow: var(--app-shadow-card-hover);
}

.config-db-card__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.config-db-card__title {
  min-width: 0;
}

.config-db-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.config-db-card h3 {
  overflow: hidden;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-db-card__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  margin-top: var(--app-space-3);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.config-db-card p {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-db-card__actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--app-space-1);
}

.config-db-card__icon-button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.config-db-card__icon-button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-main);
}

.config-db-card__icon-button.is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.config-db-card__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

@media (max-width: 1100px) {
  .config-panel__stats--four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .config-panel__stats--four {
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

  .config-db-card__main {
    flex-direction: column;
  }
}
</style>
