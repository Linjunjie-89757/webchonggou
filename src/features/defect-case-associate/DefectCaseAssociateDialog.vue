<script setup lang="ts">
import { Folder, FolderOpened, Search } from '@element-plus/icons-vue'
import { computed, nextTick, ref, watch } from 'vue'

import { caseApi, type CaseDirectoryNode, type CaseSummaryItem } from '@/entities/case'

type DirectoryTreeNode = {
  key: string
  id: number | null
  name: string
  children: DirectoryTreeNode[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    workspaceCode: string
    currentCaseId?: number | null
    currentCaseIds?: number[]
    associating?: boolean
    errorMessage?: string
  }>(),
  {
    currentCaseId: null,
    currentCaseIds: () => [],
    associating: false,
    errorMessage: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  associate: [caseIds: number[]]
}>()

const ROOT_KEY = 'root'
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const directoryLoading = ref(false)
const caseLoading = ref(false)
const tableRef = ref()
const keyword = ref('')
const selectedDirectoryKey = ref(ROOT_KEY)
const selectedCaseIds = ref<number[]>([])
const selectedCaseMap = ref<Record<number, CaseSummaryItem>>({})
const directories = ref<CaseDirectoryNode[]>([])
const cases = ref<CaseSummaryItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
let caseLoadSeq = 0

const treeData = computed<DirectoryTreeNode[]>(() => [{
  key: ROOT_KEY,
  id: null,
  name: '全部用例',
  children: directories.value.map(mapDirectoryNode),
}])

const expandedKeys = computed(() => {
  const keys = [ROOT_KEY]
  const collect = (nodes: DirectoryTreeNode[]) => {
    nodes.forEach((node) => {
      if (node.children.length) {
        keys.push(node.key)
        collect(node.children)
      }
    })
  }

  collect(treeData.value)
  return keys
})

const selectedDirectoryId = computed(() => {
  if (selectedDirectoryKey.value === ROOT_KEY) {
    return null
  }

  const parsed = Number(selectedDirectoryKey.value.replace('dir:', ''))
  return Number.isFinite(parsed) ? parsed : null
})

const canSubmit = computed(() => selectedCaseIds.value.length > 0 && !props.associating && !caseLoading.value)

function mapDirectoryNode(node: CaseDirectoryNode): DirectoryTreeNode {
  return {
    key: `dir:${node.id}`,
    id: node.id,
    name: node.name,
    children: (node.children ?? []).map(mapDirectoryNode),
  }
}

function resetDialogState() {
  keyword.value = ''
  currentPage.value = 1
  selectedDirectoryKey.value = ROOT_KEY
  selectedCaseIds.value = props.currentCaseIds.length ? [...props.currentCaseIds] : props.currentCaseId ? [props.currentCaseId] : []
  selectedCaseMap.value = {}
}

async function loadDirectories() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    directories.value = []
    return
  }

  directoryLoading.value = true
  try {
    const workspaces = await caseApi.getCaseDirectories(props.workspaceCode)
    directories.value = workspaces.find(item => item.workspaceCode === props.workspaceCode)?.children ?? []
  } finally {
    directoryLoading.value = false
  }
}

async function loadCases() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    cases.value = []
    total.value = 0
    return
  }

  const requestSeq = ++caseLoadSeq
  caseLoading.value = true
  try {
    const page = await caseApi.getCases(props.workspaceCode, {
      pageNo: currentPage.value,
      pageSize: pageSize.value,
      directoryId: selectedDirectoryId.value,
      keyword: keyword.value.trim() || undefined,
    })

    if (requestSeq !== caseLoadSeq) {
      return
    }

    cases.value = page.items
    total.value = page.total
    selectedCaseMap.value = {
      ...selectedCaseMap.value,
      ...Object.fromEntries(page.items
        .filter(item => selectedCaseIds.value.includes(item.id))
        .map(item => [item.id, item])),
    }
    void applyCurrentPageSelection()
  } finally {
    if (requestSeq === caseLoadSeq) {
      caseLoading.value = false
    }
  }
}

function handleDirectoryClick(node: DirectoryTreeNode) {
  selectedDirectoryKey.value = node.key
}

function handleRowClick(row: CaseSummaryItem, column?: { type?: string }) {
  if (column?.type === 'selection') {
    return
  }

  tableRef.value?.toggleRowSelection(row, !selectedCaseIds.value.includes(row.id))
}

function handleSelectionChange(rows: CaseSummaryItem[]) {
  const currentPageIds = cases.value.map(item => item.id)
  const currentPageSelectedIds = rows.map(item => item.id)
  const otherPageIds = selectedCaseIds.value.filter(id => !currentPageIds.includes(id))
  selectedCaseIds.value = [...otherPageIds, ...currentPageSelectedIds]
  selectedCaseMap.value = {
    ...selectedCaseMap.value,
    ...Object.fromEntries(rows.map(item => [item.id, item])),
  }
}

function isRowSelected(row: CaseSummaryItem) {
  return selectedCaseIds.value.includes(row.id)
}

async function applyCurrentPageSelection() {
  await nextTick()
  cases.value.forEach((row) => {
    tableRef.value?.toggleRowSelection(row, selectedCaseIds.value.includes(row.id))
  })
}

function submitAssociate() {
  if (!selectedCaseIds.value.length) {
    return
  }

  emit('associate', [...selectedCaseIds.value])
}

watch(
  () => props.modelValue,
  async (nextVisible) => {
    if (!nextVisible) {
      return
    }

    resetDialogState()
    await loadDirectories()
    await loadCases()
  },
  { immediate: true },
)

watch(
  () => props.workspaceCode,
  async () => {
    if (!props.modelValue) {
      return
    }

    resetDialogState()
    await loadDirectories()
    await loadCases()
  },
)

watch(selectedDirectoryId, () => {
  if (!props.modelValue) {
    return
  }

  currentPage.value = 1
  void loadCases()
})

watch([keyword, pageSize], () => {
  if (!props.modelValue) {
    return
  }

  currentPage.value = 1
  void loadCases()
})

watch(currentPage, () => {
  if (props.modelValue) {
    void loadCases()
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="关联用例"
    width="1120px"
    append-to-body
    destroy-on-close
    class="defect-case-associate-dialog"
  >
    <div class="defect-case-associate">
      <aside class="defect-case-associate__sidebar" v-loading="directoryLoading">
        <el-tree
          :data="treeData"
          node-key="key"
          :default-expanded-keys="expandedKeys"
          :current-node-key="selectedDirectoryKey"
          highlight-current
          :expand-on-click-node="false"
          class="defect-case-associate__tree"
          @node-click="handleDirectoryClick"
        >
          <template #default="{ data }">
            <div class="defect-case-associate__tree-node">
              <span class="defect-case-associate__tree-icon">
                <el-icon v-if="data.key === ROOT_KEY || data.children?.length"><FolderOpened /></el-icon>
                <el-icon v-else><Folder /></el-icon>
              </span>
              <span class="defect-case-associate__tree-label">{{ data.name }}</span>
            </div>
          </template>
        </el-tree>
      </aside>

      <section class="defect-case-associate__main">
        <div class="defect-case-associate__toolbar">
          <el-input
            v-model="keyword"
            clearable
            :prefix-icon="Search"
            placeholder="通过编号和名称搜索"
            class="defect-case-associate__search"
          />
        </div>

        <div class="defect-case-associate__table-wrap" v-loading="caseLoading">
          <el-table
            ref="tableRef"
            :data="cases"
            row-key="id"
            height="100%"
            empty-text="暂无可关联用例"
            class="defect-case-associate__table"
            @row-click="handleRowClick"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="48" :selectable="() => true" />
            <el-table-column label="用例编号" min-width="180">
              <template #default="{ row }">
                <span class="defect-case-associate__case-no" :class="{ 'is-selected': isRowSelected(row) }">
                  {{ row.caseNo || `#${row.id}` }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="用例名称" min-width="320" show-overflow-tooltip />
            <el-table-column prop="workspaceName" label="所属项目" min-width="180" show-overflow-tooltip />
            <el-table-column label="用例类型" width="140">
              <template #default="{ row }">
                {{ row.caseType || '功能用例' }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="defect-case-associate__pagination">
          <div class="defect-case-associate__selection">
            已选 {{ selectedCaseIds.length }} 条
          </div>
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            small
            layout="total, sizes, prev, pager, next"
            :total="total"
            :page-sizes="[10, 20, 50]"
          />
        </div>
        <p v-if="errorMessage" class="defect-case-associate__error">{{ errorMessage }}</p>
      </section>
    </div>

    <template #footer>
      <div class="defect-case-associate__footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmit" :loading="props.associating" @click="submitAssociate">
          关联
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.defect-case-associate {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--app-space-4);
  min-height: 560px;
}

.defect-case-associate__sidebar,
.defect-case-associate__main {
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.defect-case-associate__sidebar {
  overflow: auto;
  padding: var(--app-space-3) var(--app-space-2);
}

.defect-case-associate__main {
  display: flex;
  flex-direction: column;
  padding: var(--app-space-4);
}

.defect-case-associate__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--app-space-4);
}

.defect-case-associate__search {
  width: 260px;
}

.defect-case-associate__table-wrap {
  flex: 1;
  min-height: 0;
}

.defect-case-associate__table {
  height: 100%;
}

.defect-case-associate__tree-node {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.defect-case-associate__tree-icon {
  display: inline-flex;
  color: #d4a12a;
}

.defect-case-associate__tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-case-associate__case-no {
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.defect-case-associate__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-top: var(--app-space-4);
}

.defect-case-associate__selection {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-case-associate__error {
  margin: var(--app-space-2) 0 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-case-associate__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-3);
}

.defect-case-associate__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.defect-case-associate__table :deep(th.el-table__cell) {
  height: 42px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-case-associate__table :deep(td.el-table__cell) {
  height: 46px;
  padding: 7px 0;
  border-bottom-color: var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}

.defect-case-associate__table :deep(.cell) {
  font-size: 13px;
  line-height: 20px;
}

.defect-case-associate__table :deep(.el-table__row) {
  cursor: pointer;
}

.defect-case-associate__table :deep(.el-table__row.current-row > td.el-table__cell) {
  background: var(--app-primary-soft);
}

.defect-case-associate__tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-main);
}

.defect-case-associate__tree :deep(.el-tree-node__content:hover),
.defect-case-associate__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

:global(.defect-case-associate-dialog.el-dialog) {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16);
}

:global(.defect-case-associate-dialog .el-dialog__header) {
  display: flex;
  align-items: center;
  min-height: 56px;
  margin: 0;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border-soft);
}

:global(.defect-case-associate-dialog .el-dialog__title) {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
}

:global(.defect-case-associate-dialog .el-dialog__body) {
  padding: var(--app-space-5) var(--app-space-6);
}

:global(.defect-case-associate-dialog .el-dialog__footer) {
  padding: var(--app-space-3) var(--app-space-6);
  border-top: 1px solid var(--app-border-soft);
}

@media (max-width: 960px) {
  .defect-case-associate {
    grid-template-columns: 1fr;
  }

  .defect-case-associate__toolbar,
  .defect-case-associate__pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .defect-case-associate__search {
    width: 100%;
  }
}
</style>
