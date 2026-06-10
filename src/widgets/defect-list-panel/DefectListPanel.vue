<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  matchesDefectClientFilter,
  type DefectClientFilter,
  type DefectSummaryItem,
} from '@/entities/defect'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

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
let loadRequestSeq = 0

const filteredDefects = computed(() => defects.value.filter((item) => matchesDefectClientFilter(item, props.filter)))

const total = computed(() => filteredDefects.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pagedDefects = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value
  return filteredDefects.value.slice(start, start + pageSize.value)
})

function normalizePageNo() {
  if (pageNo.value > totalPages.value) {
    pageNo.value = totalPages.value
  }
}

async function loadDefects() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await defectApi.getDefects(props.workspaceCode)
    if (requestSeq === loadRequestSeq) {
      defects.value = Array.isArray(page.items) ? page.items : []
      pageNo.value = 1
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

watch(
  () => props.workspaceCode,
  () => {
    void loadDefects()
  },
)

watch(
  () => props.filter,
  () => {
    pageNo.value = 1
  },
  { deep: true },
)

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
            <template #default>
              <div class="defect-list-panel__actions">
                <AppButton size="small" disabled>详情</AppButton>
                <AppButton size="small" disabled>编辑</AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <AppEmptyState
        v-if="!loading && defects.length && !pagedDefects.length"
        title="暂无匹配缺陷"
        description="当前筛选条件下没有可展示的缺陷记录。"
      />

      <AppEmptyState
        v-if="!loading && !defects.length && !errorMessage"
        title="暂无缺陷"
        description="当前工作空间下还没有缺陷记录。"
      />

      <div v-if="defects.length" class="defect-list-panel__pagination">
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
