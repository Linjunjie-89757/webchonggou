<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Delete, Edit, Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  formatBrowserType,
  formatEnvironmentStatus,
  formatWebUiDateTime,
  webUiAutomationApi,
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_ENVIRONMENT_STATUS_OPTIONS,
  type SaveWebUiEnvironmentPayload,
  type WebUiBrowserType,
  type WebUiEnvironmentItem,
  type WebUiEnvironmentStatus,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'

interface EnvironmentForm {
  name: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiEnvironmentStatus
}

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    environments?: WebUiEnvironmentItem[]
    loading?: boolean
  }>(),
  {
    environments: () => [],
    loading: false,
  },
)

const emit = defineEmits<{
  refresh: []
}>()

const dialogVisible = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const editingEnvironment = ref<WebUiEnvironmentItem | null>(null)
const form = ref<EnvironmentForm>(createEmptyForm())

const dialogTitle = computed(() => (editingEnvironment.value ? '编辑环境配置' : '新建环境配置'))

function createEmptyForm(): EnvironmentForm {
  return {
    name: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 1,
  }
}

function clampTimeout(value: unknown, fallback = 10000) {
  const numberValue = Number(value)
  const normalized = Number.isFinite(numberValue) ? numberValue : fallback
  return Math.min(60000, Math.max(1000, normalized))
}

function openCreateDialog() {
  editingEnvironment.value = null
  form.value = createEmptyForm()
  dialogVisible.value = true
}

function openEditDialog(environment: WebUiEnvironmentItem) {
  editingEnvironment.value = environment
  form.value = {
    name: environment.name || '',
    baseUrl: environment.baseUrl || '',
    browserType: environment.browserType || 'CHROMIUM',
    headless: environment.headless !== false,
    defaultTimeoutMs: clampTimeout(environment.defaultTimeoutMs),
    status: environment.status === 0 ? 0 : 1,
  }
  dialogVisible.value = true
}

function validateForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入环境名称')
    return false
  }
  if (!form.value.baseUrl.trim()) {
    ElMessage.warning('请输入 Base URL')
    return false
  }
  return true
}

function buildPayload(): SaveWebUiEnvironmentPayload {
  form.value.defaultTimeoutMs = clampTimeout(form.value.defaultTimeoutMs)

  return {
    workspaceCode: props.workspaceCode,
    name: form.value.name.trim(),
    baseUrl: form.value.baseUrl.trim(),
    browserType: form.value.browserType,
    headless: form.value.headless,
    defaultTimeoutMs: form.value.defaultTimeoutMs,
    status: form.value.status,
  }
}

async function saveEnvironment() {
  if (!validateForm()) {
    return
  }

  saving.value = true
  try {
    const payload = buildPayload()
    if (editingEnvironment.value) {
      await webUiAutomationApi.updateEnvironment(props.workspaceCode, editingEnvironment.value.id, payload)
      ElMessage.success('环境配置已更新')
    } else {
      await webUiAutomationApi.createEnvironment(props.workspaceCode, payload)
      ElMessage.success('环境配置已创建')
    }
    dialogVisible.value = false
    emit('refresh')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deleteEnvironment(environment: WebUiEnvironmentItem) {
  const workspaceCode = props.workspaceCode
  deletingId.value = environment.id
  try {
    await ElMessageBox.confirm(
      `确认删除环境 "${environment.name}" 吗？删除后不可恢复。`,
      '删除环境配置',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    )
    if (props.workspaceCode !== workspaceCode) {
      ElMessage.warning('工作空间已切换，请刷新后重试')
      return
    }
    await webUiAutomationApi.deleteEnvironment(workspaceCode, environment.id)
    ElMessage.success('环境配置已删除')
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingId.value = null
  }
}

watch(
  () => props.workspaceCode,
  () => {
    dialogVisible.value = false
    editingEnvironment.value = null
  },
)
</script>

<template>
  <section class="web-ui-env-panel">
    <header class="web-ui-env-panel__header">
      <div>
        <h2>环境配置</h2>
      </div>
      <div class="web-ui-env-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="emit('refresh')">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新建环境</AppButton>
      </div>
    </header>

    <el-table
      v-loading="loading"
      class="web-ui-env-table"
      :data="environments"
      row-key="id"
      border
      empty-text="暂无环境配置"
    >
      <el-table-column prop="name" label="环境名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="baseUrl" label="Base URL" min-width="240" show-overflow-tooltip />
      <el-table-column label="浏览器" width="112">
        <template #default="{ row }">
          {{ formatBrowserType(row.browserType) }}
        </template>
      </el-table-column>
      <el-table-column label="无头" width="88">
        <template #default="{ row }">
          {{ row.headless ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column prop="defaultTimeoutMs" label="默认超时" width="112" />
      <el-table-column label="状态" width="96">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light">
            {{ formatEnvironmentStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160">
        <template #default="{ row }">
          {{ formatWebUiDateTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="144" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Edit" link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button
            :icon="Delete"
            link
            type="danger"
            :loading="deletingId === row.id"
            @click="deleteEnvironment(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <AppEmptyState
      v-if="!loading && !environments.length"
      title="暂无环境配置"
      description="当前空间还没有 Web UI 环境配置。"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新建环境</AppButton>
      </template>
    </AppEmptyState>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      destroy-on-close
    >
      <el-form :model="form" label-width="108px">
        <el-form-item label="环境名称" required>
          <el-input v-model="form.name" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="Base URL" required>
          <el-input v-model="form.baseUrl" maxlength="500" clearable placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="浏览器">
          <el-select v-model="form.browserType">
            <el-option
              v-for="item in WEB_UI_BROWSER_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="无头模式">
          <el-switch v-model="form.headless" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="默认超时">
          <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option
              v-for="item in WEB_UI_ENVIRONMENT_STATUS_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="web-ui-env-dialog__footer">
          <AppButton @click="dialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="saving" @click="saveEnvironment">保存</AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.web-ui-env-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-env-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-env-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-env-panel__actions,
.web-ui-env-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-env-table {
  width: 100%;
}

.web-ui-env-panel :deep(.el-dialog .el-select),
.web-ui-env-panel :deep(.el-dialog .el-input-number) {
  width: 100%;
}
</style>
