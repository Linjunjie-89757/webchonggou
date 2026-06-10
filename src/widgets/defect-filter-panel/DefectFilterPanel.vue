<script setup lang="ts">
import { reactive, watch } from 'vue'
import { RefreshRight, Search } from '@element-plus/icons-vue'

import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  type DefectClientFilter,
} from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const props = defineProps<{
  modelValue: DefectClientFilter
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DefectClientFilter]
  reset: []
}>()

const form = reactive<DefectClientFilter>({
  keyword: props.modelValue.keyword,
  status: props.modelValue.status,
  priority: props.modelValue.priority,
  severity: props.modelValue.severity,
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
  <div class="defect-filter-panel">
    <el-input
      v-model="form.keyword"
      class="defect-filter-panel__search"
      clearable
      placeholder="搜索编号 / 标题 / 处理人"
      :prefix-icon="Search"
    />
    <el-select v-model="form.status" class="defect-filter-panel__control" clearable placeholder="状态">
      <el-option v-for="item in defectStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <el-select v-model="form.priority" class="defect-filter-panel__control" clearable placeholder="优先级">
      <el-option v-for="item in defectPriorityOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <el-select v-model="form.severity" class="defect-filter-panel__control" clearable placeholder="严重级别">
      <el-option v-for="item in defectSeverityOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
  </div>
</template>

<style scoped>
.defect-filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.defect-filter-panel__search {
  width: min(300px, 100%);
}

.defect-filter-panel__control {
  width: 136px;
}

@media (max-width: 720px) {
  .defect-filter-panel,
  .defect-filter-panel__search,
  .defect-filter-panel__control {
    width: 100%;
  }
}
</style>
