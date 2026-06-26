<script setup lang="ts">
import { computed } from 'vue'

import type { ParamSetChangeHistoryItem } from '@/entities/config'

const visible = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    loading?: boolean
    items: ParamSetChangeHistoryItem[]
  }>(),
  {
    loading: false,
  },
)

const rows = computed(() => props.items || [])

function changeTypeLabel(type: string) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'CREATE') return '创建'
  if (normalized === 'UPDATE') return '编辑'
  if (normalized === 'STATUS') return '状态变更'
  return type || '-'
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function formatFields(value: string | null) {
  return value ? value.split(',').filter(Boolean).join(' / ') : '-'
}

function prettyJson(value: string | null) {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-param-change-history-drawer"
    title="变量集变更记录"
    size="820px"
  >
    <div v-loading="loading" class="config-param-change-history-drawer__body">
      <el-table
        v-if="rows.length"
        :data="rows"
        height="calc(100vh - 180px)"
        size="small"
      >
        <el-table-column label="变更" width="112">
          <template #default="{ row }">
            <el-tag effect="light">{{ changeTypeLabel(row.changeType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变更字段" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatFields(row.changedFields) }}</template>
        </el-table-column>
        <el-table-column label="操作人" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.operatorName || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="config-param-change-history-drawer__json-grid">
              <section>
                <span>变更前</span>
                <pre>{{ prettyJson(row.beforeJson) }}</pre>
              </section>
              <section>
                <span>变更后</span>
                <pre>{{ prettyJson(row.afterJson) }}</pre>
              </section>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        :description="loading ? '正在加载变更记录...' : '暂无变更记录'"
      />
    </div>
  </el-drawer>
</template>

<style scoped>
.config-param-change-history-drawer__body {
  min-height: 360px;
}

.config-param-change-history-drawer__json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 10px 4px;
}

.config-param-change-history-drawer__json-grid section {
  min-width: 0;
}

.config-param-change-history-drawer__json-grid span {
  display: block;
  margin-bottom: 6px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-param-change-history-drawer__json-grid pre {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-soft);
  padding: 10px;
  color: var(--app-text-primary);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
