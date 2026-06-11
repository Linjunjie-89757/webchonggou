<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  type DefectDetail,
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  type DefectClientFilter,
  type SaveDefectPayload,
  type DefectSummaryItem,
} from '@/entities/defect'
import { DefectCreateEditDialog, type DefectDialogMode } from '@/features/defect-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { DefectDetailDrawer } from '@/widgets/defect-detail-drawer'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: DefectClientFilter
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  loaded: [items: DefectSummaryItem[]]
}>()

const defects = ref<DefectSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<DefectDialogMode>('create')
const activeDefect = ref<DefectSummaryItem | null>(null)
const activeDefectDetail = ref<DefectDetail | null>(null)
const detailLoading = ref(false)
const detailErrorMessage = ref('')
const saving = ref(false)
const editingRowId = ref<number | null>(null)
const detailDrawerVisible = ref(false)
const detailDefectId = ref<number | null>(null)
let loadRequestSeq = 0
let detailRequestSeq = 0

const pagedDefects = computed(() => defects.value)

function normalizePageNo() {
  if (totalPages.value > 0 && pageNo.value > totalPages.value) {
    pageNo.value = totalPages.value
  }
}

async function loadDefects() {
  const requestSeq = ++loadRequestSeq
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
      total.value = page.total
      totalPages.value = page.totalPages
      emit('loaded', defects.value)
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  activeDefect.value = null
  activeDefectDetail.value = null
  detailErrorMessage.value = ''
  detailLoading.value = false
  dialogVisible.value = true
}

async function loadDefectDetail(item: DefectSummaryItem) {
  const requestSeq = ++detailRequestSeq
  detailLoading.value = true
  detailErrorMessage.value = ''
  editingRowId.value = item.id
  try {
    const detail = await defectApi.getDefectDetail(props.workspaceCode, item.id)
    if (requestSeq === detailRequestSeq) {
      activeDefectDetail.value = detail
    }
  } catch (error) {
    if (requestSeq === detailRequestSeq) {
      detailErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === detailRequestSeq) {
      detailLoading.value = false
      editingRowId.value = null
    }
  }
}

function openEditDialog(item: DefectSummaryItem) {
  dialogMode.value = 'edit'
  activeDefect.value = item
  activeDefectDetail.value = null
  detailErrorMessage.value = ''
  dialogVisible.value = true
  void loadDefectDetail(item)
}

function openDetailDrawer(item: DefectSummaryItem) {
  detailDefectId.value = item.id
  detailDrawerVisible.value = true
}

async function submitDefect(payload: SaveDefectPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && activeDefect.value) {
      await defectApi.updateDefect(props.workspaceCode, activeDefect.value.id, payload)
      ElMessage.success('缺陷更新成功')
    } else {
      await defectApi.createDefect(props.workspaceCode, payload)
      ElMessage.success('缺陷创建成功')
    }
    dialogVisible.value = false
    await loadDefects()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

watch(
  () => props.workspaceCode,
  () => {
    pageNo.value = 1
    dialogVisible.value = false
    detailDrawerVisible.value = false
    void loadDefects()
  },
)

watch(
  () => props.filter,
  () => {
    pageNo.value = 1
    void loadDefects()
  },
  { deep: true },
)

watch(pageNo, (value, oldValue) => {
  if (value !== oldValue) {
    void loadDefects()
  }
})

watch(pageSize, (value, oldValue) => {
  if (value !== oldValue) {
    pageNo.value = 1
    void loadDefects()
  }
})

watch(totalPages, normalizePageNo)

onMounted(() => {
  void loadDefects()
})

defineExpose({
  reload: loadDefects,
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

    <div v-else class="defect-list-panel__card">
      <div v-if="errorMessage" class="defect-list-panel__inline-error">
        <span>{{ errorMessage }}</span>
        <AppButton size="small" :icon="RefreshRight" @click="loadDefects">重试</AppButton>
      </div>

      <div class="defect-list-panel__toolbar">
        <div>
          <strong>缺陷列表</strong>
          <span>共 {{ total }} 条</span>
        </div>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增缺陷</AppButton>
      </div>

      <div class="defect-list-panel__table-wrap">
        <el-table
          v-loading="loading"
          :data="pagedDefects"
          class="defect-list-panel__table"
          size="small"
          row-key="id"
        >
          <el-table-column prop="bugNo" label="缺陷编号" min-width="130" fixed="left">
            <template #default="{ row }: { row: DefectSummaryItem }">
              <span class="defect-list-panel__code">{{ row.bugNo || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="缺陷名称" min-width="220" show-overflow-tooltip>
            <template #default="{ row }: { row: DefectSummaryItem }">
              <span class="defect-list-panel__title">{{ row.title || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="104">
            <template #default="{ row }: { row: DefectSummaryItem }">
              <DefectStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column prop="priority" label="优先级" width="88">
            <template #default="{ row }: { row: DefectSummaryItem }">
              <DefectPriorityBadge :priority="row.priority" />
            </template>
          </el-table-column>
          <el-table-column prop="severity" label="严重级别" width="104">
            <template #default="{ row }: { row: DefectSummaryItem }">
              <DefectSeverityBadge :severity="row.severity" />
            </template>
          </el-table-column>
          <el-table-column prop="assigneeName" label="处理人" min-width="104" show-overflow-tooltip>
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ row.assigneeName || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="reporterName" label="报告人" min-width="104" show-overflow-tooltip>
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ row.reporterName || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="relatedCaseCount" label="关联用例" width="96">
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ row.relatedCaseCount || 0 }}
            </template>
          </el-table-column>
          <el-table-column prop="workspaceName" label="所属空间" min-width="136" show-overflow-tooltip>
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ row.workspaceName || row.workspaceCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="更新时间" min-width="148">
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ formatDefectDateTime(row.updatedAt) }}
            </template>
          </el-table-column>
          <el-table-column prop="tags" label="标签" min-width="140" show-overflow-tooltip>
            <template #default="{ row }: { row: DefectSummaryItem }">
              {{ formatDefectTags(row.tags) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="132" fixed="right">
            <template #default="{ row }: { row: DefectSummaryItem }">
              <div class="defect-list-panel__actions">
                <AppButton size="small" @click="openDetailDrawer(row)">详情</AppButton>
                <AppButton
                  size="small"
                  :loading="editingRowId === row.id"
                  :disabled="saving"
                  @click="openEditDialog(row)"
                >
                  编辑
                </AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <AppEmptyState
        v-if="!loading && !defects.length && !errorMessage"
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

    <DefectCreateEditDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :defect-item="activeDefect"
      :defect-detail="activeDefectDetail"
      :saving="saving"
      :loading-detail="detailLoading"
      :detail-error-message="detailErrorMessage"
      :default-workspace-code="workspaceCode"
      @submit="submitDefect"
      @retry-detail="activeDefect && loadDefectDetail(activeDefect)"
    />

    <DefectDetailDrawer
      v-model="detailDrawerVisible"
      :defect-id="detailDefectId"
      :workspace-code="workspaceCode"
    />
  </section>
</template>

<style scoped>
.defect-list-panel {
  min-width: 0;
}

.defect-list-panel__card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.defect-list-panel__inline-error {
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

.defect-list-panel__inline-error span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-list-panel__toolbar > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.defect-list-panel__toolbar strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.defect-list-panel__toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.defect-list-panel__table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.defect-list-panel__table {
  min-width: 1160px;
}

.defect-list-panel__code {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-list-panel__title {
  color: var(--app-text-primary);
  font-weight: 600;
}

.defect-list-panel__actions {
  display: flex;
  gap: var(--app-space-1);
}

.defect-list-panel__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}
</style>
