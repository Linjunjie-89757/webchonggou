<script setup lang="ts">
import { CollectionTag, Cpu, RefreshRight, Search } from '@element-plus/icons-vue'

import { WEB_UI_CASE_STATUS_OPTIONS, type WebUiCaseStatus } from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import WebUiElementCollectRecentTasks, {
  type WebUiElementCollectRecentTask,
} from './WebUiElementCollectRecentTasks.vue'

defineProps<{
  keyword: string
  status: WebUiCaseStatus | ''
  qualityChecking: boolean
  recentCollectTasks: WebUiElementCollectRecentTask[]
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: WebUiCaseStatus | '']
  search: []
  reset: []
  import: []
  export: []
  'quality-check': []
  'open-recent-task': [task: WebUiElementCollectRecentTask]
  'clear-recent-tasks': []
  'ai-collect': []
}>()
</script>

<template>
  <header class="web-ui-element-library__header">
    <div class="web-ui-filter-toolbar">
      <div class="web-ui-filter-toolbar__query">
        <el-input
          :model-value="keyword"
          class="web-ui-filter-toolbar__search"
          clearable
          placeholder="搜索元素名称 / 定位值 / 备注"
          :prefix-icon="Search"
          @update:model-value="emit('update:keyword', String($event))"
          @keyup.enter="emit('search')"
        />
        <el-select
          :model-value="status"
          class="web-ui-filter-toolbar__select"
          clearable
          placeholder="状态"
          @update:model-value="emit('update:status', ($event || '') as WebUiCaseStatus | '')"
        >
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <AppButton :icon="Search" @click="emit('search')">查询</AppButton>
        <AppButton :icon="RefreshRight" @click="emit('reset')">重置</AppButton>
      </div>
      <div class="web-ui-filter-toolbar__actions">
        <AppButton @click="emit('import')">导入</AppButton>
        <AppButton @click="emit('export')">导出</AppButton>
        <AppButton :icon="CollectionTag" :loading="qualityChecking" @click="emit('quality-check')">质量检查</AppButton>
        <WebUiElementCollectRecentTasks
          :tasks="recentCollectTasks"
          @open="emit('open-recent-task', $event)"
          @clear="emit('clear-recent-tasks')"
        />
        <AppButton class="web-ui-filter-toolbar__ai" :icon="Cpu" @click="emit('ai-collect')">AI 采集</AppButton>
      </div>
    </div>
  </header>
</template>
