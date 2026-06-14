<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  type AssignDefectPayload,
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  type DefectClientFilter,
  type DefectSummaryItem,
  type TransitionDefectPayload,
} from '@/entities/defect'
import { assignDefect } from '@/features/defect-assign'
import { DefectTransitionDialog, transitionDefect } from '@/features/defect-transition'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import { DefectDetailDrawer } from '@/widgets/defect-detail-drawer'
import {
  useDefectTableSettings,
  type DefectTableColumnDefinition,
  type DefectTableColumnKey,
} from './useDefectTableSettings'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: DefectClientFilter
    embedded?: boolean
    assigneeOptions?: Array<{ label: string; value: string }>
  }>(),
  {
    workspaceCode: 'ALL',
    embedded: false,
  },
)

const emit = defineEmits<{
  loaded: [items: DefectSummaryItem[]]
}>()

const router = useRouter()
const defects = ref<DefectSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const saving = ref(false)
const detailDrawerVisible = ref(false)
const detailDefectId = ref<number | null>(null)
const activeDetailRowId = ref<number | null>(null)
const hoveredRowId = ref<number | null>(null)
const assigningDefectId = ref<number | null>(null)
const transitionDialogVisible = ref(false)
const transitioningDefect = ref<DefectSummaryItem | null>(null)
const transitioningDefectId = ref<number | null>(null)
const deletingDefectId = ref<number | null>(null)
const detailRefreshKey = ref(0)
let loadRequestSeq = 0
let pendingLoadSignature = ''

const assigneeNameMap = computed(() => new Map((props.assigneeOptions ?? []).map((item) => [item.value, item.label])))
const filteredDefects = computed(() => defects.value.filter((item) => {
  if (props.filter.assigneeId) {
    const assigneeName = assigneeNameMap.value.get(props.filter.assigneeId) ?? ''
    if ((item.assigneeName ?? '') !== assigneeName) {
      return false
    }
  }

  if (props.filter.workspaceCode && item.workspaceCode !== props.filter.workspaceCode) {
    return false
  }

  return true
}))
const pagedDefects = computed(() => filteredDefects.value)
const activeDetailIndex = computed(() => {
  if (!detailDefectId.value) {
    return null
  }

  const index = pagedDefects.value.findIndex(item => item.id === detailDefectId.value)
  return index >= 0 ? index : null
})
const tableColumnDefinitions = computed<DefectTableColumnDefinition[]>(() => [
  { key: 'bugNo', label: '缺陷编号', width: 170, required: true, defaultVisible: true },
  { key: 'title', label: '缺陷标题', minWidth: 260, required: true, defaultVisible: true, showOverflowTooltip: true },
  { key: 'status', label: '状态', width: 112, required: true, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 88, defaultVisible: true },
  { key: 'severity', label: '严重级别', width: 112, defaultVisible: true },
  { key: 'assigneeName', label: '处理人', width: 120, defaultVisible: true, showOverflowTooltip: true },
  { key: 'workspaceName', label: '所属空间', width: 132, defaultVisible: false, showOverflowTooltip: true },
  { key: 'tags', label: '标签', width: 190, defaultVisible: false, showOverflowTooltip: true },
  { key: 'reporterName', label: '创建人', width: 120, defaultVisible: false, showOverflowTooltip: true },
  { key: 'createdAt', label: '创建时间', width: 168, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', width: 120, defaultVisible: false, showOverflowTooltip: true },
  { key: 'updatedAt', label: '更新时间', width: 168, defaultVisible: false },
  { key: 'relatedCaseCount', label: '关联用例数', width: 112, defaultVisible: false },
])
const tableSettings = useDefectTableSettings({
  storageKey: 'defect-list-table-settings-v1',
  columns: tableColumnDefinitions,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
const dataGridMinWidth = computed(() => {
  const columnWidth = visibleColumns.value.reduce((total, column) => {
    if (typeof column.width === 'number') {
      return total + column.width
    }
    if (typeof column.minWidth === 'number') {
      return total + column.minWidth
    }
    return total + 120
  }, 0)

  return `${columnWidth}px`
})

const dataGridTemplateColumns = computed(() => visibleColumns.value.map((column) => {
  if (typeof column.width === 'number') {
    return `${column.width}px`
  }
  if (column.key === 'title' && typeof column.minWidth === 'number') {
    return `minmax(${column.minWidth}px, 1fr)`
  }
  if (typeof column.minWidth === 'number') {
    return `${column.minWidth}px`
  }
  return '120px'
}).join(' '))

function formatColumnValue(row: DefectSummaryItem, key: DefectTableColumnKey) {
  switch (key) {
    case 'bugNo':
      return row.bugNo || '-'
    case 'title':
      return row.title || '-'
    case 'status':
      return row.status || '-'
    case 'priority':
      return row.priority || '-'
    case 'severity':
      return row.severity || '-'
    case 'assigneeName':
      return row.assigneeName || '-'
    case 'workspaceName':
      return row.workspaceName || row.workspaceCode || '-'
    case 'tags':
      return formatDefectTags(row.tags)
    case 'reporterName':
      return row.reporterName || '-'
    case 'createdAt':
      return formatDefectDateTime(row.createdAt)
    case 'updatedByName':
      return row.updatedByName || '-'
    case 'relatedCaseCount':
      return String(row.relatedCaseCount || 0)
    case 'updatedAt':
      return formatDefectDateTime(row.updatedAt)
    default:
      return '-'
  }
}

function setHoveredRow(rowId: number | null) {
  hoveredRowId.value = rowId
}

function isRowHighlighted(rowId: number) {
  return hoveredRowId.value === rowId || activeDetailRowId.value === rowId
}

function normalizePageNo() {
  if (totalPages.value > 0 && pageNo.value > totalPages.value) {
    pageNo.value = totalPages.value
  }
}

function getClientTotalPages(totalCount: number) {
  return totalCount > 0 ? Math.ceil(totalCount / Math.max(pageSize.value, 1)) : 0
}

function reloadFromFirstPage() {
  if (pageNo.value === 1) {
    void loadDefects()
    return
  }

  pageNo.value = 1
}

async function loadDefects() {
  const loadSignature = JSON.stringify({
    workspaceCode: props.workspaceCode,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    keyword: props.filter.keyword,
    status: props.filter.status,
    priority: props.filter.priority,
    severity: props.filter.severity,
  })
  if (loading.value && pendingLoadSignature === loadSignature) {
    return
  }

  const requestSeq = ++loadRequestSeq
  pendingLoadSignature = loadSignature
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await defectApi.getDefects(props.workspaceCode, {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      keyword: props.filter.keyword,
      status: props.filter.status,
      priority: props.filter.priority,
      severity: props.filter.severity,
    })
    if (requestSeq === loadRequestSeq) {
      defects.value = Array.isArray(page.items) ? page.items : []
      pageNo.value = page.pageNo
      total.value = filteredDefects.value.length
      totalPages.value = getClientTotalPages(filteredDefects.value.length)
      emit('loaded', defects.value)
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
      pendingLoadSignature = ''
    }
  }
}

function openCreateDialog() {
  void router.push({
    path: '/bugs/create',
    query: props.workspaceCode && props.workspaceCode !== 'ALL' ? { workspace: props.workspaceCode } : undefined,
  })
}

function openEditDialog(item: DefectSummaryItem) {
  void router.push({
    path: `/bugs/${item.id}/edit`,
    query: item.workspaceCode ? { workspace: item.workspaceCode } : undefined,
  })
}

function openDetailDrawer(item: DefectSummaryItem) {
  detailDefectId.value = item.id
  activeDetailRowId.value = item.id
  detailDrawerVisible.value = true
}

function openTransitionDialog(item: DefectSummaryItem) {
  transitioningDefect.value = item
  transitionDialogVisible.value = true
}

function getActiveDetailDefect() {
  if (!detailDefectId.value) {
    return null
  }

  return pagedDefects.value.find(item => item.id === detailDefectId.value) ?? null
}

function openActiveDetailEditDialog() {
  const item = getActiveDetailDefect()
  if (item) {
    openEditDialog(item)
  }
}

function openActiveDetailTransitionDialog() {
  const item = getActiveDetailDefect()
  if (item) {
    openTransitionDialog(item)
  }
}

function navigateDetail(delta: -1 | 1) {
  if (activeDetailIndex.value === null) {
    return
  }

  const nextItem = pagedDefects.value[activeDetailIndex.value + delta]
  if (!nextItem) {
    return
  }

  openDetailDrawer(nextItem)
}

async function deleteActiveDetailDefect() {
  const item = getActiveDetailDefect()
  if (!item || deletingDefectId.value !== null) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除缺陷“${item.bugNo || item.title}”吗？删除后不可恢复。`, '删除缺陷', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })

    deletingDefectId.value = item.id
    await defectApi.deleteDefect(props.workspaceCode, item.id)
    ElMessage.success('缺陷已删除')
    detailDrawerVisible.value = false
    await loadDefects()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingDefectId.value = null
  }
}

async function submitTransitionDefect(payload: TransitionDefectPayload) {
  if (!transitioningDefect.value || transitioningDefectId.value !== null || assigningDefectId.value !== null) {
    return
  }

  transitioningDefectId.value = transitioningDefect.value.id
  try {
    const assigneeId = (payload as TransitionDefectPayload & { assigneeId?: number | null }).assigneeId
    if (typeof assigneeId === 'number' && Number.isFinite(assigneeId)) {
      const assignPayload: AssignDefectPayload = {
        workspaceCode: payload.workspaceCode,
        assigneeId,
      }
      assigningDefectId.value = transitioningDefect.value.id
      await assignDefect(transitioningDefect.value, props.workspaceCode, assignPayload)
    }

    await transitionDefect(transitioningDefect.value, props.workspaceCode, payload)
    ElMessage.success(assigneeId ? '缺陷处理成功' : '缺陷流转成功')
    transitionDialogVisible.value = false
    await loadDefects()
    detailRefreshKey.value += 1
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    assigningDefectId.value = null
    transitioningDefectId.value = null
  }
}

watch(
  () => props.workspaceCode,
  () => {
    detailDrawerVisible.value = false
    activeDetailRowId.value = null
    transitionDialogVisible.value = false
    reloadFromFirstPage()
  },
)

watch(detailDrawerVisible, (visible) => {
  if (!visible) {
    activeDetailRowId.value = null
    detailDefectId.value = null
  }
})

watch(
  () => props.filter,
  () => {
    reloadFromFirstPage()
  },
  { deep: true },
)

watch(filteredDefects, (items) => {
  total.value = items.length
  totalPages.value = getClientTotalPages(items.length)
  normalizePageNo()
})

watch(pageNo, (value, oldValue) => {
  if (value !== oldValue) {
    void loadDefects()
  }
})

watch(pageSize, (value, oldValue) => {
  if (value !== oldValue) {
    reloadFromFirstPage()
  }
})

watch(totalPages, normalizePageNo)

onMounted(() => {
  tableSettings.load()
  void loadDefects()
})

defineExpose({
  reload: loadDefects,
  openCreateDialog,
})
</script>

<template>
  <section class="defect-list-panel">
    <AppLoadingState v-if="loading && !defects.length" text="正在加载缺陷..." />

    <AppEmptyState
      v-else-if="errorMessage && !defects.length"
      title="缺陷加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadDefects">重试</AppButton>
      </template>
    </AppEmptyState>

    <div
      v-else
      :class="[
        'defect-list-panel__card',
        { 'defect-list-panel__card--embedded': embedded },
      ]"
    >
      <div v-if="errorMessage" class="defect-list-panel__inline-error">
        <span>{{ errorMessage }}</span>
        <AppButton size="small" :icon="RefreshRight" @click="loadDefects">重试</AppButton>
      </div>

      <div v-loading="loading" class="defect-list-panel__table-shell">
        <div class="defect-list-panel__table-data">
          <div class="defect-list-panel__table-scroll">
            <div
              class="defect-list-panel__grid defect-list-panel__grid--header"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div
                v-for="column in visibleColumns"
                :key="`header-${column.key}`"
                :class="['defect-list-panel__cell', `defect-list-panel__cell--${column.key}`]"
              >
                {{ column.label }}
              </div>
            </div>

            <template v-if="pagedDefects.length">
              <div
                v-for="row in pagedDefects"
                :key="row.id"
                :class="[
                  'defect-list-panel__grid',
                  'defect-list-panel__grid--row',
                  { 'is-active': activeDetailRowId === row.id },
                ]"
                :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
                @mouseenter="setHoveredRow(row.id)"
                @mouseleave="setHoveredRow(null)"
              >
                <div
                  v-for="column in visibleColumns"
                  :key="`${row.id}-${column.key}`"
                  :class="['defect-list-panel__cell', `defect-list-panel__cell--${column.key}`]"
                >
                  <button
                    v-if="column.key === 'bugNo'"
                    type="button"
                    class="defect-list-panel__code-trigger"
                    @click="openDetailDrawer(row)"
                  >
                    {{ formatColumnValue(row, column.key) }}
                  </button>

                  <div v-else-if="column.key === 'title'" class="defect-list-panel__title-cell">
                    <el-tooltip :content="row.title" placement="top">
                      <span class="defect-list-panel__title">{{ row.title || '-' }}</span>
                    </el-tooltip>
                  </div>

                  <DefectStatusBadge v-else-if="column.key === 'status'" :status="row.status" />
                  <DefectPriorityBadge v-else-if="column.key === 'priority'" :priority="row.priority" />
                  <DefectSeverityBadge v-else-if="column.key === 'severity'" :severity="row.severity" />

                  <el-tooltip
                    v-else-if="column.key === 'tags'"
                    :content="formatColumnValue(row, column.key)"
                    placement="top"
                  >
                    <span class="defect-list-panel__cell-text">{{ formatColumnValue(row, column.key) }}</span>
                  </el-tooltip>

                  <span v-else class="defect-list-panel__cell-text">{{ formatColumnValue(row, column.key) }}</span>
                </div>
              </div>
            </template>

            <div v-else class="defect-list-panel__table-empty">
              当前筛选条件下暂无缺陷记录
            </div>
          </div>
        </div>

        <div class="defect-list-panel__table-actions">
          <div class="defect-list-panel__actions-header">
            <span>操作</span>
            <AppTableSettingsTrigger @click="tableSettings.settingsVisible.value = true" />
          </div>

          <template v-if="pagedDefects.length">
            <div
              v-for="row in pagedDefects"
              :key="`action-${row.id}`"
              :class="[
                'defect-list-panel__actions-row',
                { 'is-active': isRowHighlighted(row.id) },
              ]"
              @mouseenter="setHoveredRow(row.id)"
              @mouseleave="setHoveredRow(null)"
            >
              <div class="defect-list-panel__actions">
                <AppButton size="small" @click="openDetailDrawer(row)">查看</AppButton>
                <AppButton
                  size="small"
                  :disabled="saving"
                  @click="openEditDialog(row)"
                >
                  编辑
                </AppButton>
                <AppButton
                  size="small"
                  :loading="transitioningDefectId === row.id || assigningDefectId === row.id"
                  @click="openTransitionDialog(row)"
                >
                  {{ transitioningDefectId === row.id || assigningDefectId === row.id ? '处理中' : '流转' }}
                </AppButton>
              </div>
            </div>
          </template>

          <div v-else class="defect-list-panel__actions-empty">-</div>
        </div>
      </div>
      <AppEmptyState
        v-if="!loading && !defects.length && !errorMessage"
        class="defect-list-panel__empty"
        title="暂无匹配缺陷"
        description="当前工作空间或筛选条件下没有可展示的缺陷记录。"
      />

      <div v-if="defects.length || total > 0" class="defect-list-panel__pagination">
        <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 50]"
          :total="total"
          size="small"
          layout="sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <DefectDetailDrawer
      v-model="detailDrawerVisible"
      :defect-id="detailDefectId"
      :workspace-code="workspaceCode"
      :current-index="activeDetailIndex"
      :total-count="pagedDefects.length"
      :refresh-key="detailRefreshKey"
      @edit="openActiveDetailEditDialog"
      @transition="openActiveDetailTransitionDialog"
      @delete="deleteActiveDetailDefect"
      @navigate-prev="navigateDetail(-1)"
      @navigate-next="navigateDetail(1)"
    />

    <DefectTransitionDialog
      v-model="transitionDialogVisible"
      :defect-item="transitioningDefect"
      :workspace-code="workspaceCode"
      :saving="transitioningDefectId !== null"
      @submit="submitTransitionDefect"
    />
    <AppTableColumnSettingsDrawer
      v-model="tableSettings.settingsVisible.value"
      :columns="tableSettings.drawerColumns.value"
      :dragging-key="tableSettings.draggingColumnKey.value"
      @toggle-column="tableSettings.toggleColumnVisibility"
      @drag-start="tableSettings.handleDragStart"
      @drag-end="tableSettings.handleDragEnd"
      @drop-column="tableSettings.moveColumnToTarget"
      @reset="tableSettings.reset"
    />
  </section>
</template>

<style scoped>
.defect-list-panel {
  --defect-table-header-height: 48px;
  --defect-table-row-height: 54px;
  --defect-table-actions-width: 150px;
  min-width: 0;
}

.defect-list-panel__card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}

.defect-list-panel__card--embedded {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.defect-list-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-4) var(--app-space-5) 0;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 13px;
}

.defect-list-panel__inline-error span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__table-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--defect-table-actions-width);
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg-panel);
}

.defect-list-panel__table-data {
  min-width: 0;
  overflow: visible;
}

.defect-list-panel__table-scroll {
  min-height: 100%;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-gutter: stable;
}

.defect-list-panel__grid {
  display: grid;
}

.defect-list-panel__grid--header {
  min-height: var(--defect-table-header-height);
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  background: #f8fafc;
}

.defect-list-panel__grid--row {
  min-height: var(--defect-table-row-height);
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  transition: background-color 160ms ease;
}

.defect-list-panel__grid--row:hover {
  background: #f8fafc;
}

.defect-list-panel__grid--row.is-active {
  background: #eff6ff;
}

.defect-list-panel__grid--row.is-active .defect-list-panel__code-trigger,
.defect-list-panel__grid--row.is-active .defect-list-panel__title {
  color: var(--app-primary);
}

.defect-list-panel__cell {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0 var(--app-space-5);
}

.defect-list-panel__grid--header .defect-list-panel__cell {
  min-height: var(--defect-table-header-height);
}

.defect-list-panel__cell-text {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__code-trigger {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 20px;
}

.defect-list-panel__title-cell {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
}

.defect-list-panel__code {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__title {
  display: block;
  width: 100%;
  max-width: 320px;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__table-actions {
  display: flex;
  flex-direction: column;
  width: var(--defect-table-actions-width);
  min-width: var(--defect-table-actions-width);
  border-left: 1px solid var(--app-border);
  background: var(--app-bg-panel);
  position: relative;
  z-index: 1;
}

.defect-list-panel__actions-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: var(--defect-table-header-height);
  padding: 0 8px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  background: #f8fafc;
  white-space: nowrap;
}

.defect-list-panel__actions-row {
  display: flex;
  min-height: var(--defect-table-row-height);
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
  transition: background-color 160ms ease;
}

.defect-list-panel__actions-row.is-active {
  background: #eff6ff;
}

.defect-list-panel__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  white-space: nowrap;
}

.defect-list-panel__actions > * {
  flex: 0 0 auto;
}

.defect-list-panel__actions :deep(.el-button) {
  min-height: 28px;
  padding-right: 0;
  padding-left: 0;
  border-color: transparent;
  background: transparent;
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  box-shadow: none;
}

.defect-list-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.defect-list-panel__actions :deep(.el-button:hover),
.defect-list-panel__actions :deep(.el-button:focus-visible) {
  background: transparent;
  color: var(--app-primary-hover);
}

.defect-list-panel__actions-empty {
  display: flex;
  min-height: 232px;
  border-bottom: 1px solid var(--app-border-soft);
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.defect-list-panel__table-empty {
  display: flex;
  min-height: 232px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.defect-list-panel__table-scroll::-webkit-scrollbar {
  height: 8px;
}

.defect-list-panel__table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.defect-list-panel__table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.44);
}

.defect-list-panel__table-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 134, 156, 0.72);
}

.defect-list-panel :deep(.defect-status-pill),
.defect-list-panel :deep(.defect-badge) {
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.defect-list-panel :deep(.defect-status-pill) {
  min-height: 22px;
  padding: 2px 10px;
  border-radius: 9999px;
}

.defect-list-panel :deep(.defect-badge) {
  min-height: 20px;
  padding: 2px 8px;
  border-radius: 4px;
}

.defect-list-panel__empty {
  padding: var(--app-space-7) var(--app-space-5);
}

.defect-list-panel__pagination {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 58px;
  padding: 12px var(--app-space-5);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.defect-list-panel__pagination > span {
  white-space: nowrap;
}

.defect-list-panel__pagination :deep(.el-pagination) {
  flex-wrap: nowrap;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  white-space: nowrap;
}

.defect-list-panel__pagination :deep(.el-pagination button),
.defect-list-panel__pagination :deep(.el-pager li) {
  border-radius: var(--app-radius-sm);
}

.defect-list-panel__pagination :deep(.el-pager li.is-active) {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-list-panel__pagination :deep(.el-select__wrapper),
.defect-list-panel__pagination :deep(.el-input__wrapper) {
  min-height: 26px;
  border-radius: var(--app-radius-sm);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}
</style>
