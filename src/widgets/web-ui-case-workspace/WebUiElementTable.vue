<script setup lang="ts">
import { Delete, Edit, VideoPlay, View } from '@element-plus/icons-vue'

import {
  formatLocatorType,
  formatWebUiDateTime,
  type WebUiElementItem,
} from '@/entities/web-ui-automation'

defineProps<{
  loading: boolean
  elements: WebUiElementItem[]
  validatingId: number | null
  deletingId: number | null
}>()

const emit = defineEmits<{
  'selection-change': [items: WebUiElementItem[]]
  detail: [item: WebUiElementItem]
  validate: [item: WebUiElementItem]
  edit: [item: WebUiElementItem]
  delete: [item: WebUiElementItem]
  references: [item: WebUiElementItem]
}>()
</script>

<template>
  <el-table
    v-loading="loading"
    :data="elements"
    row-key="id"
    border
    empty-text="暂无 Web UI 元素"
    @selection-change="emit('selection-change', $event)"
  >
    <el-table-column type="selection" width="48" />
    <el-table-column prop="pageName" label="页面对象" min-width="130" show-overflow-tooltip />
    <el-table-column prop="groupName" label="分组" min-width="120" show-overflow-tooltip>
      <template #default="{ row }">{{ row.groupName || '-' }}</template>
    </el-table-column>
    <el-table-column prop="elementName" label="元素名称" min-width="160" show-overflow-tooltip />
    <el-table-column label="定位方式" width="112">
      <template #default="{ row }">{{ formatLocatorType(row.locatorType) }}</template>
    </el-table-column>
    <el-table-column prop="locatorValue" label="定位值" min-width="220" show-overflow-tooltip />
    <el-table-column label="状态" width="88">
      <template #default="{ row }">
        <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="light">
          {{ row.status === 'ENABLED' ? '启用' : '停用' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="验证结果" min-width="150">
      <template #default="{ row }">
        <el-tag
          v-if="row.lastValidateResult"
          :type="row.lastValidateResult === 'PASSED' ? 'success' : 'danger'"
          effect="light"
        >
          {{ row.lastValidateResult === 'PASSED' ? `通过 ${row.lastMatchCount ?? 0}` : '失败' }}
        </el-tag>
        <span v-else>-</span>
      </template>
    </el-table-column>
    <el-table-column label="最近验证" width="160">
      <template #default="{ row }">{{ formatWebUiDateTime(row.lastValidateAt) }}</template>
    </el-table-column>
    <el-table-column label="引用" width="76">
      <template #default="{ row }">
        <el-button
          v-if="row.usageCount > 0"
          link
          type="primary"
          @click="emit('references', row)"
        >
          {{ row.usageCount }}
        </el-button>
        <span v-else>0</span>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="240" fixed="right">
      <template #default="{ row }">
        <el-button :icon="View" link type="primary" @click="emit('detail', row)">详情</el-button>
        <el-button :icon="VideoPlay" link type="primary" :loading="validatingId === row.id" @click="emit('validate', row)">验证</el-button>
        <el-button :icon="Edit" link type="primary" @click="emit('edit', row)">编辑</el-button>
        <el-button :icon="Delete" link type="danger" :loading="deletingId === row.id" @click="emit('delete', row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
