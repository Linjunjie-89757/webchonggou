<script setup lang="ts">
import { reactive, watch } from 'vue'
import { RefreshRight, Search } from '@element-plus/icons-vue'

import {
  caseExecutionStatusOptions,
  casePriorityOptions,
  caseReviewStatusOptions,
  type CaseClientFilter,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  modelValue: CaseClientFilter
  executorOptions?: string[]
  creatorOptions?: string[]
  workspaceOptions?: Array<{ label: string; value: string }>
  showWorkspaceFilter?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CaseClientFilter]
  reset: []
}>()

const form = reactive<CaseClientFilter>({
  keyword: props.modelValue.keyword,
  priority: props.modelValue.priority,
  reviewStatus: props.modelValue.reviewStatus,
  executionStatus: props.modelValue.executionStatus,
  executorName: props.modelValue.executorName,
  createdByName: props.modelValue.createdByName,
  workspaceCode: props.modelValue.workspaceCode,
})

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(form, value)
  },
  { deep: true },
)

watch(
  form,
  () => {
    emit('update:modelValue', { ...form })
  },
  { deep: true },
)

function resetFilters() {
  emit('reset')
}
</script>

<template>
  <div class="case-filter-panel">
    <el-input
      v-model="form.keyword"
      class="case-filter-panel__search"
      clearable
      placeholder="搜索编号或名称"
      :prefix-icon="Search"
    />
    <el-select v-model="form.priority" class="case-filter-panel__control" clearable placeholder="优先级">
      <el-option v-for="item in casePriorityOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <el-select v-model="form.reviewStatus" class="case-filter-panel__control" clearable placeholder="评审状态">
      <el-option
        v-for="item in caseReviewStatusOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-select v-model="form.executionStatus" class="case-filter-panel__control" clearable placeholder="执行状态">
      <el-option
        v-for="item in caseExecutionStatusOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-select v-model="form.executorName" class="case-filter-panel__control" clearable filterable placeholder="执行人">
      <el-option v-for="item in executorOptions" :key="`executor-${item}`" :label="item" :value="item" />
    </el-select>
    <el-select v-model="form.createdByName" class="case-filter-panel__control" clearable filterable placeholder="创建人">
      <el-option v-for="item in creatorOptions" :key="`creator-${item}`" :label="item" :value="item" />
    </el-select>
    <el-select
      v-if="showWorkspaceFilter"
      v-model="form.workspaceCode"
      class="case-filter-panel__control"
      clearable
      filterable
      placeholder="所属空间"
    >
      <el-option v-for="item in workspaceOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
  </div>
</template>

<style scoped>
.case-filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.case-filter-panel__search {
  width: 220px;
}

.case-filter-panel__control {
  width: 112px;
}

@media (max-width: 720px) {
  .case-filter-panel,
  .case-filter-panel__search,
  .case-filter-panel__control {
    width: 100%;
  }
}
</style>
