<script setup lang="ts">
import { computed } from 'vue'

import type { ConfigReferenceSummary } from '@/entities/config'

const visible = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    loading?: boolean
    summary: ConfigReferenceSummary | null
  }>(),
  {
    title: '引用详情',
    loading: false,
  },
)

const items = computed(() => props.summary?.items || [])

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 19)
}
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-reference-drawer"
    :title="title"
    size="720px"
  >
    <div v-loading="loading" class="config-reference-drawer__body">
      <div v-if="summary" class="config-reference-drawer__summary">
        <div>
          <span>配置对象</span>
          <strong>{{ summary.resourceName }}</strong>
        </div>
        <el-tag type="info" effect="light">引用 {{ summary.totalCount || 0 }}</el-tag>
      </div>

      <el-table
        v-if="items.length"
        :data="items"
        border
        height="calc(100vh - 220px)"
        size="small"
      >
        <el-table-column label="来源类型" prop="sourceType" min-width="130" />
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <div class="config-reference-drawer__name">{{ row.sourceName || '-' }}</div>
            <div class="config-reference-drawer__sub">#{{ row.sourceId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="引用字段" prop="referenceField" min-width="120" />
        <el-table-column label="所属空间" min-width="120">
          <template #default="{ row }">
            {{ row.workspaceName || row.workspaceCode || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        :description="loading ? '正在加载引用详情...' : '暂无引用'"
      />
    </div>
  </el-drawer>
</template>

<style scoped>
.config-reference-drawer__body {
  min-height: 360px;
}

.config-reference-drawer__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-4);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
}

.config-reference-drawer__summary span {
  display: block;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-reference-drawer__summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.config-reference-drawer__name {
  color: var(--app-text-primary);
}

.config-reference-drawer__sub {
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}
</style>
