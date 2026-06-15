<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  formatDefectDateTime,
  type DefectSummaryItem,
} from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    bugs: DefectSummaryItem[]
    keyword: string
    loading?: boolean
    associating?: boolean
  }>(),
  {
    loading: false,
    associating: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:keyword': [value: string]
  associate: [bugIds: number[]]
}>()

const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selectedBugIds = ref<number[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const keywordValue = computed({
  get: () => props.keyword,
  set: value => emit('update:keyword', value),
})

const canSubmit = computed(() => selectedBugIds.value.length > 0 && !props.associating)

function handleSelectionChange(rows: DefectSummaryItem[]) {
  selectedBugIds.value = rows.map(row => row.id)
}

function submitAssociate() {
  if (!selectedBugIds.value.length) {
    return
  }
  emit('associate', selectedBugIds.value)
}

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      selectedBugIds.value = []
      tableRef.value?.clearSelection()
    }
  },
)

watch(
  () => props.bugs,
  () => {
    selectedBugIds.value = selectedBugIds.value.filter(id => props.bugs.some(item => item.id === id))
  },
)
</script>

<template>
  <AppDrawer
    v-model="visible"
    title="关联缺陷"
    size="1198px"
    drawer-class="case-defect-associate-drawer-host"
  >
    <div class="case-defect-associate-drawer">
      <div class="case-defect-associate-drawer__toolbar">
        <el-input
          v-model="keywordValue"
          :prefix-icon="Search"
          clearable
          placeholder="通过缺陷编号 / 缺陷名称搜索"
        />
      </div>

      <div class="case-defect-associate-drawer__table">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="bugs"
          height="100%"
          row-key="id"
          empty-text="暂无可关联缺陷"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="52" reserve-selection />
          <el-table-column prop="bugNo" label="缺陷编号" width="160" show-overflow-tooltip />
          <el-table-column prop="title" label="缺陷名称" min-width="240" show-overflow-tooltip />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <DefectStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="优先级" width="96">
            <template #default="{ row }">
              <DefectPriorityBadge :priority="row.priority" />
            </template>
          </el-table-column>
          <el-table-column label="严重程度" width="116">
            <template #default="{ row }">
              <DefectSeverityBadge :severity="row.severity" />
            </template>
          </el-table-column>
          <el-table-column prop="assigneeName" label="处理人" width="120" show-overflow-tooltip />
          <el-table-column prop="reporterName" label="创建人" width="120" show-overflow-tooltip />
          <el-table-column label="创建时间" width="176">
            <template #default="{ row }">
              {{ formatDefectDateTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <AppButton :disabled="associating" @click="visible = false">取消</AppButton>
      <AppButton type="primary" :disabled="!canSubmit" :loading="associating" @click="submitAssociate">
        关联
      </AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.case-defect-associate-drawer {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-5) var(--app-space-6);
}

:global(.case-defect-associate-drawer-host .el-drawer__header) {
  margin-bottom: 0;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
}

:global(.case-defect-associate-drawer-host .el-drawer__body) {
  min-height: 0;
  padding: 0;
}

:global(.case-defect-associate-drawer-host .el-drawer__footer) {
  padding: 0;
}

.case-defect-associate-drawer__toolbar {
  display: flex;
  justify-content: flex-end;
}

.case-defect-associate-drawer__toolbar :deep(.el-input) {
  width: 320px;
}

.case-defect-associate-drawer__toolbar :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}

.case-defect-associate-drawer__table {
  flex: 1;
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-defect-associate-drawer__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.case-defect-associate-drawer__table :deep(th.el-table__cell) {
  height: 44px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.case-defect-associate-drawer__table :deep(td.el-table__cell) {
  height: 52px;
  border-bottom-color: var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}
</style>
