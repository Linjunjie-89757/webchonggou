<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Connection, CopyDocument, Delete, Edit, Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  ConfigTypeBadge,
  configApi,
  type ConfigReferenceSummary,
  type CreateMockApplicationPayload,
  type CreateMockEndpointPayload,
  type CreateMockScenarioPayload,
  type MockApplicationItem,
  type MockCallLogItem,
  type MockEndpointItem,
  type MockScenarioItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
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

type DialogMode = 'create' | 'edit'

const applications = ref<MockApplicationItem[]>([])
const endpoints = ref<MockEndpointItem[]>([])
const scenarios = ref<MockScenarioItem[]>([])
const logs = ref<MockCallLogItem[]>([])
const activeAppId = ref<number | null>(null)
const activeEndpointId = ref<number | null>(null)
const activeScenarioId = ref<number | null>(null)
const activeLog = ref<MockCallLogItem | null>(null)
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const appDialogVisible = ref(false)
const endpointDialogVisible = ref(false)
const scenarioDialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const referenceLoading = ref(false)
const referenceSummary = ref<ConfigReferenceSummary | null>(null)
const logDrawerVisible = ref(false)
const appDialogMode = ref<DialogMode>('create')
const endpointDialogMode = ref<DialogMode>('create')
const scenarioDialogMode = ref<DialogMode>('create')
const editingAppId = ref<number | null>(null)
const editingEndpointId = ref<number | null>(null)
const editingScenarioId = ref<number | null>(null)

const appForm = reactive<CreateMockApplicationPayload>({
  appName: '',
  appCode: '',
  description: '',
  status: 1,
})

const endpointForm = reactive<CreateMockEndpointPayload>({
  appId: 0,
  endpointName: '',
  httpMethod: 'POST',
  pathPattern: '/pay/notify',
  description: '',
  status: 1,
})

const scenarioForm = reactive<CreateMockScenarioPayload>({
  appId: 0,
  endpointId: 0,
  scenarioName: '',
  priority: 100,
  matchJson: '{}',
  responseStatus: 200,
  responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
  responseBody: '{"success":true}',
  responseDelayMs: 0,
  variablesJson: '{}',
  status: 1,
})

const activeApp = computed(() => applications.value.find(item => item.id === activeAppId.value) || null)
const activeEndpoint = computed(() => endpoints.value.find(item => item.id === activeEndpointId.value) || null)
const filteredApplications = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) {
    return applications.value
  }
  return applications.value.filter(item =>
    item.appName.toLowerCase().includes(value)
    || item.appCode.toLowerCase().includes(value)
    || (item.description || '').toLowerCase().includes(value),
  )
})
const appEndpoints = computed(() => endpoints.value.filter(item => item.appId === activeAppId.value))
const endpointScenarios = computed(() => scenarios.value.filter(item => item.endpointId === activeEndpointId.value))
const appLogs = computed(() => logs.value.filter(item => !activeAppId.value || item.appId === activeAppId.value))
const invokePath = computed(() => {
  if (!activeApp.value || !activeEndpoint.value) {
    return ''
  }
  return `/api/mock/${activeApp.value.appCode}${activeEndpoint.value.pathPattern}`
})

async function loadAll() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [appPage, endpointPage, scenarioPage, logPage] = await Promise.all([
      configApi.getMockApplications(props.workspaceCode),
      configApi.getMockEndpoints(props.workspaceCode),
      configApi.getMockScenarios(props.workspaceCode),
      configApi.getMockCallLogs(props.workspaceCode),
    ])
    applications.value = appPage.items || []
    endpoints.value = endpointPage.items || []
    scenarios.value = scenarioPage.items || []
    logs.value = logPage.items || []
    normalizeActiveApp()
    normalizeActiveEndpoint()
    normalizeActiveScenario()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function normalizeActiveApp() {
  if (!activeAppId.value || !applications.value.some(item => item.id === activeAppId.value)) {
    activeAppId.value = applications.value[0]?.id ?? null
  }
}

function normalizeActiveEndpoint() {
  const candidates = appEndpoints.value
  if (!activeEndpointId.value || !candidates.some(item => item.id === activeEndpointId.value)) {
    activeEndpointId.value = candidates[0]?.id ?? null
  }
}

function normalizeActiveScenario() {
  const candidates = endpointScenarios.value
  if (!activeScenarioId.value || !candidates.some(item => item.id === activeScenarioId.value)) {
    activeScenarioId.value = candidates[0]?.id ?? null
  }
}

function selectApplication(app: MockApplicationItem) {
  activeAppId.value = app.id
  normalizeActiveEndpoint()
  normalizeActiveScenario()
}

function selectEndpoint(endpoint: MockEndpointItem) {
  activeEndpointId.value = endpoint.id
  normalizeActiveScenario()
}

function openCreateAppDialog() {
  appDialogMode.value = 'create'
  editingAppId.value = null
  Object.assign(appForm, {
    appName: '',
    appCode: '',
    description: '',
    status: 1,
  })
  appDialogVisible.value = true
}

function openEditAppDialog(app: MockApplicationItem) {
  appDialogMode.value = 'edit'
  editingAppId.value = app.id
  Object.assign(appForm, {
    appName: app.appName,
    appCode: app.appCode,
    description: app.description || '',
    status: app.status,
  })
  appDialogVisible.value = true
}

function openCreateEndpointDialog() {
  if (!activeAppId.value) {
    ElMessage.warning('请先创建或选择 Mock 应用')
    return
  }
  endpointDialogMode.value = 'create'
  editingEndpointId.value = null
  Object.assign(endpointForm, {
    appId: activeAppId.value,
    endpointName: '',
    httpMethod: 'POST',
    pathPattern: '/pay/notify',
    description: '',
    status: 1,
  })
  endpointDialogVisible.value = true
}

function openEditEndpointDialog(endpoint: MockEndpointItem) {
  endpointDialogMode.value = 'edit'
  editingEndpointId.value = endpoint.id
  Object.assign(endpointForm, {
    appId: endpoint.appId,
    endpointName: endpoint.endpointName,
    httpMethod: endpoint.httpMethod,
    pathPattern: endpoint.pathPattern,
    description: endpoint.description || '',
    status: endpoint.status,
  })
  endpointDialogVisible.value = true
}

function openCreateScenarioDialog() {
  if (!activeAppId.value || !activeEndpointId.value) {
    ElMessage.warning('请先选择 Mock 接口')
    return
  }
  scenarioDialogMode.value = 'create'
  editingScenarioId.value = null
  Object.assign(scenarioForm, {
    appId: activeAppId.value,
    endpointId: activeEndpointId.value,
    scenarioName: '',
    priority: 100,
    matchJson: '{}',
    responseStatus: 200,
    responseHeadersJson: '{"Content-Type":"application/json;charset=UTF-8"}',
    responseBody: '{"success":true}',
    responseDelayMs: 0,
    variablesJson: '{}',
    status: 1,
  })
  scenarioDialogVisible.value = true
}

function openEditScenarioDialog(scenario: MockScenarioItem) {
  scenarioDialogMode.value = 'edit'
  editingScenarioId.value = scenario.id
  Object.assign(scenarioForm, {
    appId: scenario.appId,
    endpointId: scenario.endpointId,
    scenarioName: scenario.scenarioName,
    priority: scenario.priority,
    matchJson: scenario.matchJson || '{}',
    responseStatus: scenario.responseStatus || 200,
    responseHeadersJson: scenario.responseHeadersJson || '{}',
    responseBody: scenario.responseBody || '',
    responseDelayMs: scenario.responseDelayMs || 0,
    variablesJson: scenario.variablesJson || '{}',
    status: scenario.status,
  })
  scenarioDialogVisible.value = true
}

function validateJson(text: string, label: string) {
  try {
    JSON.parse(text || '{}')
    return true
  } catch {
    ElMessage.warning(`${label} 不是合法 JSON`)
    return false
  }
}

async function submitApplication() {
  if (!appForm.appName.trim() || !appForm.appCode.trim()) {
    ElMessage.warning('请输入应用名称和应用编码')
    return
  }
  saving.value = true
  try {
    const saved = appDialogMode.value === 'edit' && editingAppId.value
      ? await configApi.updateMockApplication(props.workspaceCode, editingAppId.value, appForm)
      : await configApi.createMockApplication(props.workspaceCode, appForm)
    ElMessage.success(appDialogMode.value === 'edit' ? 'Mock 应用已更新' : 'Mock 应用已创建')
    activeAppId.value = saved.id
    appDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitEndpoint() {
  if (!endpointForm.endpointName.trim() || !endpointForm.pathPattern.trim()) {
    ElMessage.warning('请输入接口名称和匹配路径')
    return
  }
  saving.value = true
  try {
    const saved = endpointDialogMode.value === 'edit' && editingEndpointId.value
      ? await configApi.updateMockEndpoint(props.workspaceCode, editingEndpointId.value, endpointForm)
      : await configApi.createMockEndpoint(props.workspaceCode, endpointForm)
    ElMessage.success(endpointDialogMode.value === 'edit' ? 'Mock 接口已更新' : 'Mock 接口已创建')
    activeEndpointId.value = saved.id
    endpointDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function submitScenario() {
  if (!scenarioForm.scenarioName.trim()) {
    ElMessage.warning('请输入场景名称')
    return
  }
  if (!validateJson(scenarioForm.matchJson || '{}', '匹配规则')) {
    return
  }
  if (!validateJson(scenarioForm.responseHeadersJson || '{}', '响应头')) {
    return
  }
  if (!validateJson(scenarioForm.variablesJson || '{}', '模板变量')) {
    return
  }
  saving.value = true
  try {
    const saved = scenarioDialogMode.value === 'edit' && editingScenarioId.value
      ? await configApi.updateMockScenario(props.workspaceCode, editingScenarioId.value, scenarioForm)
      : await configApi.createMockScenario(props.workspaceCode, scenarioForm)
    ElMessage.success(scenarioDialogMode.value === 'edit' ? 'Mock 场景已更新' : 'Mock 场景已创建')
    activeScenarioId.value = saved.id
    scenarioDialogVisible.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeApplication(row: MockApplicationItem) {
  await confirmAndRun(
    `删除 Mock 应用「${row.appName}」会同时删除下属接口、场景和调用日志。确认删除？`,
    async () => {
      await configApi.deleteMockApplication(props.workspaceCode, row.id)
      if (activeAppId.value === row.id) {
        activeAppId.value = null
      }
    },
  )
}

async function openApplicationReferences(row: MockApplicationItem) {
  referenceDrawerVisible.value = true
  referenceLoading.value = true
  referenceSummary.value = null
  try {
    referenceSummary.value = await configApi.getMockApplicationReferences(props.workspaceCode, row.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    referenceLoading.value = false
  }
}

async function removeEndpoint(row: MockEndpointItem) {
  await confirmAndRun(
    `删除 Mock 接口「${row.endpointName}」会同时删除下属场景和调用日志。确认删除？`,
    async () => {
      await configApi.deleteMockEndpoint(props.workspaceCode, row.id)
      if (activeEndpointId.value === row.id) {
        activeEndpointId.value = null
      }
    },
  )
}

async function removeScenario(row: MockScenarioItem) {
  await confirmAndRun(`确认删除 Mock 场景「${row.scenarioName}」？相关调用日志也会清理。`, async () => {
    await configApi.deleteMockScenario(props.workspaceCode, row.id)
    if (activeScenarioId.value === row.id) {
      activeScenarioId.value = null
    }
  })
}

async function confirmAndRun(message: string, action: () => Promise<void>) {
  try {
    await ElMessageBox.confirm(message, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await action()
    ElMessage.success('已删除')
    await loadAll()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function copyInvokePath() {
  if (!invokePath.value) {
    return
  }
  await navigator.clipboard.writeText(invokePath.value)
  ElMessage.success('调用地址已复制')
}

function openLog(row: MockCallLogItem) {
  activeLog.value = row
  logDrawerVisible.value = true
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 19)
}

function prettyJson(value: string | null) {
  if (!value) {
    return '-'
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

watch(activeAppId, () => {
  normalizeActiveEndpoint()
  normalizeActiveScenario()
})

watch(activeEndpointId, () => {
  normalizeActiveScenario()
})

watch(
  () => props.workspaceCode,
  () => {
    activeAppId.value = null
    activeEndpointId.value = null
    activeScenarioId.value = null
    void loadAll()
  },
)

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <section class="config-mock-panel">
    <header class="config-mock-panel__header">
      <div>
        <h2>Mock 服务</h2>
        <p>维护可被接口自动化、Web UI 和外部回调复用的模拟服务。</p>
      </div>
      <div class="config-mock-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadAll">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateAppDialog">新增应用</AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && !applications.length" text="正在加载 Mock 服务..." />

    <AppEmptyState
      v-else-if="errorMessage && !applications.length"
      title="Mock 服务加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadAll">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="config-mock-layout">
      <aside class="config-mock-apps">
        <div class="config-mock-apps__toolbar">
          <el-input v-model="keyword" clearable placeholder="搜索应用" :prefix-icon="Search" />
        </div>
        <div v-if="filteredApplications.length" class="config-mock-apps__list">
          <button
            v-for="app in filteredApplications"
            :key="app.id"
            type="button"
            class="config-mock-app"
            :class="{ 'is-active': app.id === activeAppId }"
            @click="selectApplication(app)"
          >
            <span>
              <strong>{{ app.appName }}</strong>
              <small>{{ app.appCode }}</small>
            </span>
            <ConfigTypeBadge :label="app.status === 1 ? '启用' : '停用'" :tone="app.status === 1 ? 'success' : 'default'" />
          </button>
        </div>
        <AppEmptyState v-else title="暂无 Mock 应用" description="创建应用后即可获得 /api/mock/{appCode} 调用入口。">
          <template #actions>
            <AppButton size="small" type="primary" :icon="Plus" @click="openCreateAppDialog">新增应用</AppButton>
          </template>
        </AppEmptyState>
      </aside>

      <main class="config-mock-workspace">
        <div v-if="activeApp" class="config-mock-summary">
          <div>
            <div class="config-mock-summary__title">
              <h3>{{ activeApp.appName }}</h3>
              <ConfigTypeBadge :label="activeApp.status === 1 ? '启用中' : '已停用'" :tone="activeApp.status === 1 ? 'success' : 'default'" />
            </div>
            <p>{{ activeApp.description || '暂无描述' }}</p>
          </div>
          <div class="config-mock-summary__actions">
            <AppButton size="small" :icon="Connection" @click="openApplicationReferences(activeApp)">引用详情</AppButton>
            <AppButton size="small" :icon="Edit" @click="openEditAppDialog(activeApp)">编辑应用</AppButton>
            <AppButton size="small" :icon="Delete" @click="removeApplication(activeApp)">删除</AppButton>
          </div>
        </div>

        <AppEmptyState v-else title="请选择 Mock 应用" description="左侧选择应用后维护接口、场景和调用日志。" />

        <template v-if="activeApp">
          <section class="config-mock-url">
            <span>当前接口调用地址</span>
            <code>{{ invokePath || '请选择接口' }}</code>
            <AppButton size="small" :icon="CopyDocument" :disabled="!invokePath" @click="copyInvokePath">复制</AppButton>
          </section>

          <section class="config-mock-section">
            <div class="config-mock-section__header">
              <div>
                <h3>Mock 接口</h3>
                <p>按请求方法和路径匹配进入应用的请求。</p>
              </div>
              <AppButton size="small" type="primary" :icon="Plus" @click="openCreateEndpointDialog">新增接口</AppButton>
            </div>
            <el-table :data="appEndpoints" row-key="id" height="220" highlight-current-row @row-click="selectEndpoint">
              <el-table-column prop="httpMethod" label="方法" width="90" />
              <el-table-column prop="endpointName" label="接口名称" min-width="160" show-overflow-tooltip />
              <el-table-column prop="pathPattern" label="匹配路径" min-width="180" show-overflow-tooltip />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <ConfigTypeBadge :label="row.status === 1 ? '启用' : '停用'" :tone="row.status === 1 ? 'success' : 'default'" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <div class="config-mock-table-actions">
                    <button type="button" @click.stop="openEditEndpointDialog(row)">编辑</button>
                    <button type="button" @click.stop="removeEndpoint(row)">删除</button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="config-mock-section">
            <div class="config-mock-section__header">
              <div>
                <h3>Mock 场景</h3>
                <p>同一接口可按 Header、Query、Body 或 JSONPath 命中不同响应。</p>
              </div>
              <AppButton size="small" type="primary" :icon="Plus" :disabled="!activeEndpointId" @click="openCreateScenarioDialog">新增场景</AppButton>
            </div>
            <el-table :data="endpointScenarios" row-key="id" height="260">
              <el-table-column prop="priority" label="优先级" width="90" />
              <el-table-column prop="scenarioName" label="场景名称" min-width="160" show-overflow-tooltip />
              <el-table-column prop="responseStatus" label="响应码" width="90" />
              <el-table-column prop="responseDelayMs" label="延迟(ms)" width="100" />
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <ConfigTypeBadge :label="row.status === 1 ? '启用' : '停用'" :tone="row.status === 1 ? 'success' : 'default'" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <div class="config-mock-table-actions">
                    <button type="button" @click="openEditScenarioDialog(row)">编辑</button>
                    <button type="button" @click="removeScenario(row)">删除</button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="config-mock-section">
            <div class="config-mock-section__header">
              <div>
                <h3>调用日志</h3>
                <p>最近 100 条调用记录，包含请求、响应和命中场景。</p>
              </div>
            </div>
            <el-table :data="appLogs" row-key="id" height="240">
              <el-table-column prop="httpMethod" label="方法" width="90" />
              <el-table-column prop="requestPath" label="路径" min-width="180" show-overflow-tooltip />
              <el-table-column prop="scenarioName" label="命中场景" min-width="160" show-overflow-tooltip />
              <el-table-column prop="responseStatus" label="响应码" width="90" />
              <el-table-column label="结果" width="90">
                <template #default="{ row }">
                  <ConfigTypeBadge :label="row.matched ? '命中' : '未命中'" :tone="row.matched ? 'success' : 'danger'" />
                </template>
              </el-table-column>
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="90" fixed="right">
                <template #default="{ row }">
                  <div class="config-mock-table-actions">
                    <button type="button" @click="openLog(row)">详情</button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </template>
      </main>
    </div>

    <el-dialog v-model="appDialogVisible" :title="appDialogMode === 'edit' ? '编辑 Mock 应用' : '新增 Mock 应用'" width="520px">
      <div class="config-mock-form">
        <label>
          <span>应用名称 *</span>
          <el-input v-model="appForm.appName" placeholder="例如：支付网关 Mock" />
        </label>
        <label>
          <span>应用编码 *</span>
          <el-input v-model="appForm.appCode" placeholder="pay-service" />
        </label>
        <label>
          <span>描述</span>
          <el-input v-model="appForm.description" type="textarea" :rows="3" placeholder="说明该 Mock 应用的用途" />
        </label>
        <label>
          <span>状态</span>
          <el-switch v-model="appForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </label>
      </div>
      <template #footer>
        <AppButton :disabled="saving" @click="appDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submitApplication">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="endpointDialogVisible" :title="endpointDialogMode === 'edit' ? '编辑 Mock 接口' : '新增 Mock 接口'" width="560px">
      <div class="config-mock-form">
        <div class="config-mock-form__grid">
          <label>
            <span>请求方法 *</span>
            <el-select v-model="endpointForm.httpMethod">
              <el-option label="ANY" value="ANY" />
              <el-option label="GET" value="GET" />
              <el-option label="POST" value="POST" />
              <el-option label="PUT" value="PUT" />
              <el-option label="PATCH" value="PATCH" />
              <el-option label="DELETE" value="DELETE" />
            </el-select>
          </label>
          <label>
            <span>状态</span>
            <el-switch v-model="endpointForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
          </label>
        </div>
        <label>
          <span>接口名称 *</span>
          <el-input v-model="endpointForm.endpointName" placeholder="例如：支付回调" />
        </label>
        <label>
          <span>匹配路径 *</span>
          <el-input v-model="endpointForm.pathPattern" placeholder="/pay/notify 或 /pay/**" />
        </label>
        <label>
          <span>描述</span>
          <el-input v-model="endpointForm.description" type="textarea" :rows="3" />
        </label>
      </div>
      <template #footer>
        <AppButton :disabled="saving" @click="endpointDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submitEndpoint">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="scenarioDialogVisible" :title="scenarioDialogMode === 'edit' ? '编辑 Mock 场景' : '新增 Mock 场景'" width="760px">
      <div class="config-mock-form">
        <div class="config-mock-form__grid">
          <label>
            <span>场景名称 *</span>
            <el-input v-model="scenarioForm.scenarioName" placeholder="例如：微信支付成功" />
          </label>
          <label>
            <span>优先级</span>
            <el-input-number v-model="scenarioForm.priority" :min="0" :max="9999" controls-position="right" />
          </label>
          <label>
            <span>响应码</span>
            <el-input-number v-model="scenarioForm.responseStatus" :min="100" :max="599" controls-position="right" />
          </label>
          <label>
            <span>响应延迟(ms)</span>
            <el-input-number v-model="scenarioForm.responseDelayMs" :min="0" :max="10000" controls-position="right" />
          </label>
        </div>
        <label>
          <span>匹配规则 JSON</span>
          <el-input
            v-model="scenarioForm.matchJson"
            type="textarea"
            :rows="5"
            placeholder='{"query":{"payType":"WECHAT"},"jsonPath":{"path":"$.out_trade_no","value":"ORDER_001"}}'
          />
        </label>
        <label>
          <span>模板变量 JSON</span>
          <el-input v-model="scenarioForm.variablesJson" type="textarea" :rows="3" placeholder='{"tradeStatus":"SUCCESS"}' />
        </label>
        <label>
          <span>响应头 JSON</span>
          <el-input v-model="scenarioForm.responseHeadersJson" type="textarea" :rows="3" />
        </label>
        <label>
          <span>响应体</span>
          <el-input v-model="scenarioForm.responseBody" type="textarea" :rows="6" placeholder='{"success":true,"tradeNo":"${out_trade_no}"}' />
        </label>
        <label>
          <span>状态</span>
          <el-switch v-model="scenarioForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
        </label>
      </div>
      <template #footer>
        <AppButton :disabled="saving" @click="scenarioDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="saving" @click="submitScenario">保存</AppButton>
      </template>
    </el-dialog>

    <el-drawer v-model="logDrawerVisible" title="调用日志详情" size="560px">
      <div v-if="activeLog" class="config-mock-log-detail">
        <dl>
          <dt>接口</dt>
          <dd>{{ activeLog.endpointName || '-' }}</dd>
          <dt>场景</dt>
          <dd>{{ activeLog.scenarioName || '-' }}</dd>
          <dt>请求</dt>
          <dd>{{ activeLog.httpMethod }} {{ activeLog.requestPath }}</dd>
          <dt>响应</dt>
          <dd>{{ activeLog.responseStatus || '-' }} / {{ activeLog.status }}</dd>
        </dl>
        <h4>请求头</h4>
        <pre>{{ prettyJson(activeLog.requestHeadersJson) }}</pre>
        <h4>请求体</h4>
        <pre>{{ prettyJson(activeLog.requestBody) }}</pre>
        <h4>响应头</h4>
        <pre>{{ prettyJson(activeLog.responseHeadersJson) }}</pre>
        <h4>响应体</h4>
        <pre>{{ prettyJson(activeLog.responseBody) }}</pre>
      </div>
    </el-drawer>
    <ConfigReferenceDrawer
      v-model="referenceDrawerVisible"
      title="Mock 应用引用详情"
      :loading="referenceLoading"
      :summary="referenceSummary"
    />
  </section>
</template>

<style scoped>
.config-mock-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-mock-panel__header,
.config-mock-section__header,
.config-mock-summary,
.config-mock-url {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-mock-panel__header h2,
.config-mock-section__header h3,
.config-mock-summary h3 {
  margin: 0;
  color: var(--app-text-primary);
}

.config-mock-panel__header p,
.config-mock-section__header p,
.config-mock-summary p {
  margin: 4px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-mock-panel__actions,
.config-mock-summary__actions,
.config-mock-table-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.config-mock-layout {
  display: grid;
  min-height: 0;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--app-space-5);
}

.config-mock-apps,
.config-mock-workspace,
.config-mock-section,
.config-mock-url,
.config-mock-summary {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.config-mock-apps {
  display: flex;
  min-height: 640px;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
}

.config-mock-apps__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  overflow: auto;
}

.config-mock-app {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
}

.config-mock-app:hover {
  background: var(--app-bg-muted);
}

.config-mock-app.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.config-mock-app strong,
.config-mock-app small {
  display: block;
}

.config-mock-app small {
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-mock-workspace {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
}

.config-mock-summary,
.config-mock-url,
.config-mock-section {
  padding: var(--app-space-4);
}

.config-mock-summary__title {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.config-mock-url {
  justify-content: flex-start;
  background: var(--app-bg-muted);
}

.config-mock-url span {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-mock-url code {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-mock-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-table-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
}

.config-mock-table-actions button:hover {
  color: var(--app-primary-hover);
}

.config-mock-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-mock-form label {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-mock-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-mock-form :deep(.el-select),
.config-mock-form :deep(.el-input-number) {
  width: 100%;
}

.config-mock-log-detail {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.config-mock-log-detail dl {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: var(--app-space-2) var(--app-space-3);
  margin: 0;
}

.config-mock-log-detail dt {
  color: var(--app-text-secondary);
  font-weight: 600;
}

.config-mock-log-detail dd {
  min-width: 0;
  margin: 0;
  color: var(--app-text-primary);
  word-break: break-all;
}

.config-mock-log-detail h4 {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-primary);
}

.config-mock-log-detail pre {
  max-height: 240px;
  overflow: auto;
  margin: 0;
  padding: var(--app-space-3);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1100px) {
  .config-mock-layout {
    grid-template-columns: 1fr;
  }

  .config-mock-apps {
    min-height: auto;
  }
}
</style>
