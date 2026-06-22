<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, Download, FileSpreadsheet, Plus, Trash2, Upload } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  apiAutomationApi,
  type ApiScenarioTestDatasetColumn,
  type ApiScenarioTestDatasetDetail,
  type ApiScenarioTestDatasetItem,
  type ApiScenarioTestDatasetRow,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

const props = defineProps<{
  scenarioId: number | null
  workspaceCode: string
  workspaceReady: boolean
}>()

const emit = defineEmits<{
  (event: 'dirty'): void
}>()

type ViewMode = 'list' | 'editor'

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const mode = ref<ViewMode>('list')
const datasets = ref<ApiScenarioTestDatasetItem[]>([])
const activeDataset = ref<ApiScenarioTestDatasetDetail | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const variableDialogVisible = ref(false)
const variableDraft = ref<ApiScenarioTestDatasetColumn[]>([])
const editor = reactive({
  id: null as number | null,
  datasetName: '',
  enabled: true,
  sourceType: 'MANUAL',
  caseDescColumn: null as string | null,
  columns: [] as ApiScenarioTestDatasetColumn[],
  rows: [] as ApiScenarioTestDatasetRow[],
})

const canUseApi = computed(() => Boolean(props.workspaceReady && props.scenarioId && props.workspaceCode && props.workspaceCode !== 'ALL'))
const hasColumns = computed(() => editor.columns.length > 0)
const displayRows = computed(() => editor.rows.map((row, index) => ({ ...row, rowIndex: index + 1 })))

function markDirty() {
  emit('dirty')
}

function resetEditor() {
  editor.id = null
  editor.datasetName = ''
  editor.enabled = true
  editor.sourceType = 'MANUAL'
  editor.caseDescColumn = null
  editor.columns = []
  editor.rows = []
  activeDataset.value = null
}

async function loadDatasets() {
  if (!canUseApi.value || !props.scenarioId) {
    datasets.value = []
    return
  }
  loading.value = true
  try {
    datasets.value = await apiAutomationApi.getScenarioTestDatasets(props.workspaceCode, props.scenarioId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function enterCreate() {
  resetEditor()
  editor.datasetName = `测试数据集 ${datasets.value.length + 1}`
  mode.value = 'editor'
}

async function enterEdit(item: ApiScenarioTestDatasetItem) {
  if (!props.scenarioId) return
  loading.value = true
  try {
    const detail = await apiAutomationApi.getScenarioTestDataset(props.workspaceCode, props.scenarioId, item.id)
    activeDataset.value = detail
    editor.id = detail.id
    editor.datasetName = detail.datasetName
    editor.enabled = detail.enabled
    editor.sourceType = detail.sourceType || 'MANUAL'
    editor.caseDescColumn = detail.caseDescColumn || null
    editor.columns = detail.columns.map(column => ({ ...column }))
    editor.rows = detail.rows.map((row, index) => ({
      rowIndex: index + 1,
      values: { ...row.values },
    }))
    mode.value = 'editor'
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function backToList() {
  mode.value = 'list'
  resetEditor()
  void loadDatasets()
}

function openVariableDialog() {
  variableDraft.value = editor.columns.length
    ? editor.columns.map(column => ({ ...column }))
    : [{ name: '', sourceType: 'MANUAL' }]
  variableDialogVisible.value = true
}

function addVariableColumn() {
  variableDraft.value.push({ name: '', sourceType: 'MANUAL' })
}

function removeVariableColumn(index: number) {
  variableDraft.value.splice(index, 1)
  if (!variableDraft.value.length) {
    addVariableColumn()
  }
}

function saveVariableColumns() {
  const names = variableDraft.value.map(column => column.name.trim()).filter(Boolean)
  if (!names.length) {
    ElMessage.warning('请至少设置一个变量名称')
    return
  }
  if (new Set(names).size !== names.length) {
    ElMessage.warning('变量名称不能重复')
    return
  }
  const nextColumns = names.map(name => ({ name, sourceType: 'MANUAL' }))
  editor.rows = editor.rows.map((row, index) => {
    const values: Record<string, string> = {}
    nextColumns.forEach((column) => {
      values[column.name] = row.values[column.name] ?? ''
    })
    return { rowIndex: index + 1, values }
  })
  editor.columns = nextColumns
  if (!editor.rows.length) {
    addRow()
  }
  variableDialogVisible.value = false
  markDirty()
}

function addRow() {
  const values: Record<string, string> = {}
  editor.columns.forEach((column) => {
    values[column.name] = ''
  })
  editor.rows.push({
    rowIndex: editor.rows.length + 1,
    values,
  })
  markDirty()
}

function removeRow(index: number) {
  editor.rows.splice(index, 1)
  editor.rows = editor.rows.map((row, rowIndex) => ({ ...row, rowIndex: rowIndex + 1 }))
  markDirty()
}

function updateCell(row: ApiScenarioTestDatasetRow, columnName: string, value: string | number) {
  row.values[columnName] = String(value ?? '')
  markDirty()
}

function buildPayload() {
  return {
    datasetName: editor.datasetName.trim(),
    enabled: editor.enabled,
    sourceType: editor.sourceType,
    sourceFileId: null,
    caseDescColumn: editor.caseDescColumn || (editor.columns.some(column => column.name === 'caseDesc') ? 'caseDesc' : null),
    columns: editor.columns,
    rows: editor.rows.map((row, index) => ({
      rowIndex: index + 1,
      values: row.values,
    })),
  }
}

async function saveDataset() {
  if (!props.scenarioId) return
  if (!editor.datasetName.trim()) {
    ElMessage.warning('请输入测试数据集名称')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    const detail = editor.id
      ? await apiAutomationApi.updateScenarioTestDataset(props.workspaceCode, props.scenarioId, editor.id, payload)
      : await apiAutomationApi.createScenarioTestDataset(props.workspaceCode, props.scenarioId, payload)
    activeDataset.value = detail
    editor.id = detail.id
    ElMessage.success('测试数据集已保存')
    mode.value = 'list'
    resetEditor()
    await loadDatasets()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deleteDataset(item: ApiScenarioTestDatasetItem) {
  if (!props.scenarioId) return
  await ElMessageBox.confirm(`确认删除测试数据集「${item.datasetName}」吗？`, '删除测试数据集', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.deleteScenarioTestDataset(props.workspaceCode, props.scenarioId, item.id)
  ElMessage.success('测试数据集已删除')
  await loadDatasets()
}

function chooseCsv() {
  if (!canUseApi.value) {
    ElMessage.warning('请先保存场景并切换到具体工作空间')
    return
  }
  fileInputRef.value?.click()
}

async function handleCsvImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.scenarioId) return
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
    ElMessage.warning('本期先支持 CSV 文件')
    return
  }
  importing.value = true
  try {
    const detail = await apiAutomationApi.importScenarioTestDatasetCsv(
      props.workspaceCode,
      props.scenarioId,
      file,
      editor.datasetName || file.name,
    )
    editor.id = detail.id
    editor.datasetName = detail.datasetName
    editor.enabled = detail.enabled
    editor.sourceType = detail.sourceType
    editor.caseDescColumn = detail.caseDescColumn
    editor.columns = detail.columns.map(column => ({ ...column }))
    editor.rows = detail.rows.map((row, index) => ({ rowIndex: index + 1, values: { ...row.values } }))
    activeDataset.value = detail
    mode.value = 'editor'
    ElMessage.success('CSV 已导入')
    await loadDatasets()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    importing.value = false
  }
}

function escapeCsvCell(value: string) {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function exportCsv() {
  if (!editor.columns.length) {
    ElMessage.warning('请先设置变量列')
    return
  }
  const headers = editor.columns.map(column => column.name)
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...editor.rows.map(row => headers.map(header => escapeCsvCell(row.values[header] || '')).join(',')),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${editor.datasetName || 'scenario-test-data'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

watch(() => [props.scenarioId, props.workspaceCode, props.workspaceReady], () => {
  mode.value = 'list'
  resetEditor()
  void loadDatasets()
})

onMounted(() => {
  void loadDatasets()
})
</script>

<template>
  <section class="scenario-test-data-panel" v-loading="loading">
    <template v-if="mode === 'list'">
      <header class="scenario-test-data-toolbar">
        <div>
          <strong>测试数据</strong>
          <span>场景运行时按数据集行驱动，变量优先级：步骤提取 / 脚本变量 &gt; 测试数据当前行 &gt; 运行时变量 &gt; 变量集 &gt; 环境变量。</span>
        </div>
        <el-button type="primary" :icon="Plus" :disabled="!canUseApi" @click="enterCreate">新建数据</el-button>
      </header>

      <div class="scenario-test-data-table">
        <div class="scenario-test-data-table-head">
          <span>测试数据名称</span>
          <span>ID</span>
          <span>修改时间</span>
          <span>操作</span>
        </div>
        <button
          v-for="item in datasets"
          :key="item.id"
          type="button"
          class="scenario-test-data-row"
          @click="enterEdit(item)"
        >
          <span>
            <strong>{{ item.datasetName }}</strong>
            <small>{{ item.columns.map(column => column.name).join(' / ') || '暂无变量列' }}</small>
          </span>
          <span>{{ item.id }}</span>
          <span>{{ item.updatedAt || '-' }}</span>
          <span class="scenario-test-data-actions">
            <el-button text @click.stop="enterEdit(item)">编辑</el-button>
            <el-button text :icon="Trash2" @click.stop="deleteDataset(item)" />
          </span>
        </button>
        <div v-if="!datasets.length" class="scenario-test-data-empty">
          <FileSpreadsheet :size="34" />
          <strong>当前测试数据为空</strong>
          <span>点击新建数据后设置变量列，或在编辑页导入 CSV 格式测试数据。</span>
          <el-button type="primary" :icon="Plus" :disabled="!canUseApi" @click="enterCreate">新建数据</el-button>
        </div>
      </div>
    </template>

    <template v-else>
      <header class="scenario-test-data-editor-head">
        <div class="scenario-test-data-editor-title">
          <button type="button" class="scenario-test-data-icon-button" @click="backToList">
            <ArrowLeft :size="16" />
          </button>
          <el-input v-model="editor.datasetName" class="scenario-test-data-name" placeholder="测试数据集名称" @input="markDirty" />
        </div>
        <div class="scenario-test-data-editor-actions">
          <el-button @click="backToList">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveDataset">保存</el-button>
        </div>
      </header>

      <div class="scenario-test-data-info">
        每个数据集可包含多个变量；场景运行时，使用变量的地方会读取当前行对应的值。
      </div>

      <div class="scenario-test-data-editor-toolbar">
        <el-button @click="openVariableDialog">设置变量（列）</el-button>
        <el-button :icon="Upload" :loading="importing" @click="chooseCsv">导入 CSV</el-button>
        <el-button :icon="Download" :disabled="!hasColumns" @click="exportCsv">导出 CSV</el-button>
        <el-switch v-model="editor.enabled" active-text="启用" inactive-text="停用" @change="markDirty" />
        <input ref="fileInputRef" class="scenario-test-data-file" type="file" accept=".csv,.txt" @change="handleCsvImport">
      </div>

      <div v-if="!hasColumns" class="scenario-test-data-editor-empty">
        <FileSpreadsheet :size="40" />
        <strong>当前测试数据为空</strong>
        <span>请设置变量列，或上传 CSV 格式测试数据。</span>
        <el-button type="primary" @click="openVariableDialog">设置变量（列）</el-button>
      </div>

      <div v-else class="scenario-test-data-grid">
        <el-table :data="displayRows" border height="100%">
          <el-table-column label="#" width="64" fixed>
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column
            v-for="column in editor.columns"
            :key="column.name"
            :label="column.name"
            min-width="160"
          >
            <template #default="{ row }">
              <el-input
                :model-value="row.values[column.name] || ''"
                @input="(value: string | number) => updateCell(row, column.name, value)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="92" fixed="right">
            <template #default="{ $index }">
              <el-button text :icon="Trash2" @click="removeRow($index)" />
            </template>
          </el-table-column>
        </el-table>
        <div class="scenario-test-data-grid-footer">
          <el-button text :icon="Plus" @click="addRow">添加行</el-button>
          <el-button text :icon="Plus" @click="openVariableDialog">添加变量</el-button>
        </div>
      </div>
    </template>

    <el-dialog v-model="variableDialogVisible" title="设置变量（列）" width="560px">
      <div class="scenario-variable-dialog">
        <div
          v-for="(column, index) in variableDraft"
          :key="index"
          class="scenario-variable-row"
        >
          <span class="scenario-variable-drag">::</span>
          <el-input v-model="column.name" placeholder="变量名称" />
          <el-select v-model="column.sourceType">
            <el-option label="手动输入" value="MANUAL" />
            <el-option label="CSV 列" value="CSV_COLUMN" />
          </el-select>
          <el-button text :icon="Trash2" @click="removeVariableColumn(index)" />
        </div>
        <el-button text :icon="Plus" @click="addVariableColumn">添加</el-button>
      </div>
      <template #footer>
        <el-button @click="variableDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveVariableColumns">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.scenario-test-data-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #ffffff;
}

.scenario-test-data-toolbar,
.scenario-test-data-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.scenario-test-data-toolbar > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.scenario-test-data-toolbar strong {
  color: #111827;
  font-size: 14px;
}

.scenario-test-data-toolbar span,
.scenario-test-data-row small,
.scenario-test-data-empty span,
.scenario-test-data-editor-empty span,
.scenario-test-data-info {
  color: #667085;
  font-size: 12px;
}

.scenario-test-data-table {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 12px 16px 16px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.scenario-test-data-table-head,
.scenario-test-data-row {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 96px 180px 128px;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
}

.scenario-test-data-table-head {
  min-height: 40px;
  border-bottom: 1px solid #edf0f5;
  background: #f9fafb;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.scenario-test-data-row {
  width: 100%;
  min-height: 58px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
  color: #344054;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.scenario-test-data-row:hover {
  background: #f8fafc;
}

.scenario-test-data-row > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.scenario-test-data-row strong {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-test-data-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.scenario-test-data-empty,
.scenario-test-data-editor-empty {
  display: flex;
  min-height: 280px;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #98a2b3;
  text-align: center;
}

.scenario-test-data-empty strong,
.scenario-test-data-editor-empty strong {
  color: #344054;
  font-size: 14px;
}

.scenario-test-data-editor-title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
}

.scenario-test-data-icon-button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  cursor: pointer;
}

.scenario-test-data-icon-button:hover {
  background: #f8fafc;
}

.scenario-test-data-name {
  max-width: 360px;
}

.scenario-test-data-editor-actions,
.scenario-test-data-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scenario-test-data-info {
  margin: 12px 16px 0;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  line-height: 20px;
  padding: 9px 12px;
}

.scenario-test-data-editor-toolbar {
  padding: 12px 16px;
}

.scenario-test-data-file {
  display: none;
}

.scenario-test-data-grid {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 0 16px 16px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.scenario-test-data-grid-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 10px;
  border-top: 1px solid #edf0f5;
  background: #f9fafb;
}

.scenario-variable-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scenario-variable-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 132px 36px;
  align-items: center;
  gap: 8px;
}

.scenario-variable-drag {
  color: #98a2b3;
  font-size: 13px;
  text-align: center;
}
</style>
