<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Delete, RefreshCw, Upload } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { apiAutomationApi, type ApiDataFileDetail, type ApiDataFileItem } from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

const props = defineProps<{
  workspaceCode: string
  workspaceReady: boolean
  enabled: boolean
  dataFileId: number | null
  dataFileNameSnapshot: string | null
  caseDescColumn: string | null
  failureStrategy: string | null
}>()

const emit = defineEmits<{
  (event: 'update:enabled', value: boolean): void
  (event: 'update:dataFileId', value: number | null): void
  (event: 'update:dataFileNameSnapshot', value: string | null): void
  (event: 'update:caseDescColumn', value: string | null): void
  (event: 'update:failureStrategy', value: string): void
  (event: 'dirty'): void
}>()

const loading = ref(false)
const uploading = ref(false)
const files = ref<ApiDataFileItem[]>([])
const activeDetail = ref<ApiDataFileDetail | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const columnDialogVisible = ref(false)
const columnForm = reactive({
  caseDescColumn: props.caseDescColumn || 'caseDesc',
})
const query = reactive({
  keyword: '',
})

const activeColumns = computed(() => activeDetail.value?.columns ?? [])
const activeRows = computed(() => activeDetail.value?.previewRows ?? [])
const selectedFile = computed(() => files.value.find(item => item.id === props.dataFileId) || null)

function markDirty() {
  emit('dirty')
}

async function loadFiles() {
  if (!props.workspaceReady || !props.workspaceCode || props.workspaceCode === 'ALL') {
    files.value = []
    activeDetail.value = null
    return
  }
  loading.value = true
  try {
    const page = await apiAutomationApi.getDataFiles(props.workspaceCode, {
      keyword: query.keyword.trim(),
      pageNo: 1,
      pageSize: 50,
    })
    files.value = page.items
    if (props.dataFileId && files.value.some(item => item.id === props.dataFileId)) {
      await loadDetail(props.dataFileId)
    } else if (!props.dataFileId) {
      activeDetail.value = null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function loadDetail(id: number) {
  activeDetail.value = await apiAutomationApi.getDataFile(props.workspaceCode, id)
}

async function selectFile(row: ApiDataFileItem) {
  emit('update:enabled', true)
  emit('update:dataFileId', row.id)
  emit('update:dataFileNameSnapshot', row.fileName)
  emit('update:caseDescColumn', row.caseDescColumn || props.caseDescColumn || 'caseDesc')
  emit('update:failureStrategy', props.failureStrategy || 'STOP_ON_ROW_FAILURE')
  markDirty()
  await loadDetail(row.id)
}

function clearBinding() {
  emit('update:enabled', false)
  emit('update:dataFileId', null)
  emit('update:dataFileNameSnapshot', null)
  emit('update:caseDescColumn', 'caseDesc')
  markDirty()
}

function chooseFile(acceptExcel = false) {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间')
    return
  }
  if (acceptExcel) {
    ElMessage.info('Excel 解析后续支持，本期请上传 CSV 文件')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
    ElMessage.warning('本期先支持 CSV 文件')
    return
  }
  uploading.value = true
  try {
    const detail = await apiAutomationApi.uploadDataFile(props.workspaceCode, file, {
      fileName: file.name,
      caseDescColumn: props.caseDescColumn || 'caseDesc',
    })
    ElMessage.success('CSV 已上传')
    emit('update:enabled', true)
    emit('update:dataFileId', detail.id)
    emit('update:dataFileNameSnapshot', detail.fileName)
    emit('update:caseDescColumn', detail.caseDescColumn || 'caseDesc')
    markDirty()
    await loadFiles()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    uploading.value = false
  }
}

function openColumnDialog() {
  columnForm.caseDescColumn = props.caseDescColumn || activeDetail.value?.caseDescColumn || 'caseDesc'
  columnDialogVisible.value = true
}

function saveColumnSettings() {
  emit('update:caseDescColumn', columnForm.caseDescColumn || 'caseDesc')
  markDirty()
  columnDialogVisible.value = false
}

function updateFailureStrategy(value: string | number | boolean) {
  emit('update:failureStrategy', String(value))
  markDirty()
}

async function deleteFile(row: ApiDataFileItem) {
  await ElMessageBox.confirm(`确认删除数据文件「${row.fileName}」吗？`, '删除数据文件', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await apiAutomationApi.deleteDataFile(props.workspaceCode, row.id)
  ElMessage.success('数据文件已删除')
  if (props.dataFileId === row.id) {
    clearBinding()
    activeDetail.value = null
  }
  await loadFiles()
}

watch(() => props.workspaceCode, () => {
  activeDetail.value = null
  void loadFiles()
})

watch(() => props.dataFileId, id => {
  if (id) {
    void loadDetail(id)
  } else {
    activeDetail.value = null
  }
})

onMounted(() => {
  void loadFiles()
})
</script>

<template>
  <section class="scenario-test-data-panel" v-loading="loading">
    <header class="scenario-test-data-head">
      <div>
        <strong>测试数据</strong>
        <span>变量优先级：步骤提取 / 脚本变量 &gt; 当前数据行 &gt; 运行时变量 &gt; 变量集 &gt; 环境变量</span>
      </div>
      <div class="scenario-test-data-actions">
        <el-input
          v-model="query.keyword"
          class="scenario-test-data-search"
          clearable
          placeholder="搜索测试数据"
          @keyup.enter="loadFiles"
          @clear="loadFiles"
        />
        <el-button :icon="RefreshCw" @click="loadFiles">刷新</el-button>
        <el-button @click="openColumnDialog">设置变量（列）</el-button>
        <el-button :loading="uploading" :icon="Upload" type="primary" @click="chooseFile(false)">上传 CSV</el-button>
        <el-button @click="chooseFile(true)">上传 Excel</el-button>
        <input ref="fileInputRef" class="scenario-test-data-file-input" type="file" accept=".csv,.txt" @change="handleFileChange">
      </div>
    </header>

    <div v-if="selectedFile" class="scenario-test-data-binding">
      <span>当前绑定</span>
      <strong>{{ selectedFile.fileName }}</strong>
      <small>{{ selectedFile.rowCount }} 行 · caseDesc 列：{{ props.caseDescColumn || 'caseDesc' }}</small>
      <el-select :model-value="props.failureStrategy || 'STOP_ON_ROW_FAILURE'" class="scenario-test-data-strategy" @change="updateFailureStrategy">
        <el-option label="失败后停止" value="STOP_ON_ROW_FAILURE" />
        <el-option label="失败后继续下一行" value="CONTINUE_ON_ROW_FAILURE" />
      </el-select>
      <el-button text @click="clearBinding">取消绑定</el-button>
    </div>

    <main class="scenario-test-data-main">
      <section class="scenario-test-data-list">
        <div class="scenario-test-data-list-head">
          <span>测试数据名称</span>
          <span>ID</span>
          <span>修改时间</span>
          <span>操作</span>
        </div>
        <button
          v-for="item in files"
          :key="item.id"
          type="button"
          :class="['scenario-test-data-row', { active: item.id === props.dataFileId }]"
          @click="selectFile(item)"
        >
          <span>
            <strong>{{ item.fileName }}</strong>
            <small>{{ item.columns.join(' / ') || '暂无列信息' }}</small>
          </span>
          <span>{{ item.id }}</span>
          <span>{{ item.updatedAt || '-' }}</span>
          <span class="scenario-test-data-row-actions">
            <el-button text @click.stop="selectFile(item)">绑定</el-button>
            <el-button text :icon="Delete" @click.stop="deleteFile(item)" />
          </span>
        </button>
        <div v-if="!files.length" class="scenario-test-data-empty">
          <strong>当前测试数据为空</strong>
          <span>请设置变量列，或上传 CSV 格式测试数据。</span>
          <el-button type="primary" @click="openColumnDialog">设置变量（列）</el-button>
        </div>
      </section>

      <section class="scenario-test-data-preview">
        <template v-if="activeDetail">
          <div class="scenario-test-data-preview-head">
            <div>
              <strong>{{ activeDetail.fileName }}</strong>
              <span>预览前 {{ activeRows.length }} 行 / 共 {{ activeDetail.rowCount }} 行</span>
            </div>
            <el-tag size="small">{{ activeDetail.fileType }}</el-tag>
          </div>
          <el-table :data="activeRows" height="100%" border>
            <el-table-column prop="rowIndex" label="行号" width="72" fixed />
            <el-table-column prop="caseDesc" label="caseDesc" min-width="160" />
            <el-table-column
              v-for="column in activeColumns"
              :key="column"
              :label="column"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.values[column] ?? '' }}
              </template>
            </el-table-column>
          </el-table>
        </template>
        <div v-else class="scenario-test-data-empty is-preview">
          <strong>选择测试数据查看预览</strong>
          <span>CSV 列名会作为场景运行变量名，例如 ${productId}、${amount}。</span>
        </div>
      </section>
    </main>

    <el-dialog v-model="columnDialogVisible" title="设置变量（列）" width="520px">
      <div class="scenario-test-data-column-dialog">
        <p>本期 CSV 每一列会按列名注入为场景运行变量。你可以指定哪一列作为报告里的用例描述。</p>
        <label>
          <span>caseDesc 列</span>
          <el-select v-model="columnForm.caseDescColumn" filterable allow-create default-first-option>
            <el-option label="caseDesc" value="caseDesc" />
            <el-option v-for="column in activeColumns" :key="column" :label="column" :value="column" />
          </el-select>
        </label>
        <div class="scenario-test-data-column-list">
          <span v-for="column in activeColumns" :key="column">{{ column }}</span>
          <em v-if="!activeColumns.length">上传或选择 CSV 后可查看变量列</em>
        </div>
      </div>
      <template #footer>
        <el-button @click="columnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveColumnSettings">保存</el-button>
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

.scenario-test-data-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.scenario-test-data-head > div:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.scenario-test-data-head strong {
  color: #111827;
  font-size: 14px;
}

.scenario-test-data-head span,
.scenario-test-data-binding small,
.scenario-test-data-row small,
.scenario-test-data-empty span,
.scenario-test-data-preview-head span {
  color: #667085;
  font-size: 12px;
}

.scenario-test-data-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.scenario-test-data-search {
  width: 220px;
}

.scenario-test-data-file-input {
  display: none;
}

.scenario-test-data-binding {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 16px;
  border-bottom: 1px solid #edf0f5;
  background: #f8fafc;
}

.scenario-test-data-binding > span {
  color: #667085;
  font-size: 12px;
}

.scenario-test-data-binding strong {
  color: #111827;
  font-size: 13px;
}

.scenario-test-data-strategy {
  width: 168px;
  margin-left: auto;
}

.scenario-test-data-main {
  display: grid;
  min-height: 360px;
  flex: 1;
  grid-template-columns: minmax(360px, 42%) minmax(0, 1fr);
  gap: 12px;
  padding: 12px 16px 16px;
}

.scenario-test-data-list,
.scenario-test-data-preview {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
}

.scenario-test-data-list {
  display: flex;
  flex-direction: column;
}

.scenario-test-data-list-head,
.scenario-test-data-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) 72px 136px 108px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
}

.scenario-test-data-list-head {
  min-height: 38px;
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

.scenario-test-data-row:hover,
.scenario-test-data-row.active {
  background: #eff6ff;
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

.scenario-test-data-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.scenario-test-data-preview {
  display: flex;
  flex-direction: column;
}

.scenario-test-data-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid #edf0f5;
}

.scenario-test-data-preview-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.scenario-test-data-empty {
  display: flex;
  min-height: 220px;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #667085;
  text-align: center;
}

.scenario-test-data-empty strong {
  color: #344054;
  font-size: 14px;
}

.scenario-test-data-empty.is-preview {
  height: 100%;
}

.scenario-test-data-column-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scenario-test-data-column-dialog p {
  margin: 0;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.scenario-test-data-column-dialog label {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.scenario-test-data-column-dialog label > span {
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.scenario-test-data-column-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border: 1px solid #edf0f5;
  border-radius: 6px;
  background: #f8fafc;
  padding: 10px;
}

.scenario-test-data-column-list span {
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  line-height: 22px;
  padding: 0 10px;
}

.scenario-test-data-column-list em {
  color: #98a2b3;
  font-size: 12px;
  font-style: normal;
}
</style>
