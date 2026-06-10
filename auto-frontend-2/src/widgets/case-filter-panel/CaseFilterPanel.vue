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
      placeholder="搜索编号 / 名称 / 模块"
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
    <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
  </div>
</template>

<style scoped>
.case-filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-filter-panel__search {
  width: min(300px, 100%);
}

.case-filter-panel__control {
  width: 136px;
}

@media (max-width: 720px) {
  .case-filter-panel,
  .case-filter-panel__search,
  .case-filter-panel__control {
    width: 100%;
  }
}
</style>
