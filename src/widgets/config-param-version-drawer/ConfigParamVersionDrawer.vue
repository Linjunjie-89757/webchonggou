<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ParamSetVersionItem } from '@/entities/config'

const visible = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    loading?: boolean
    rollbackingId?: number | null
    items: ParamSetVersionItem[]
  }>(),
  {
    loading: false,
    rollbackingId: null,
  },
)

const emit = defineEmits<{
  rollback: [item: ParamSetVersionItem]
}>()

const rows = computed(() => props.items || [])
const compareIds = ref<number[]>([])
const compareVersions = computed(() => compareIds.value
  .map(id => rows.value.find(item => item.id === id))
  .filter((item): item is ParamSetVersionItem => Boolean(item)))
const compareRows = computed(() => {
  const [left, right] = compareVersions.value
  if (!left || !right) return []
  return [
    {
      field: 'paramName',
      label: '名称',
      left: left.paramName || '-',
      right: right.paramName || '-',
      changed: left.paramName !== right.paramName,
    },
    {
      field: 'status',
      label: '状态',
      left: statusLabel(left.status),
      right: statusLabel(right.status),
      changed: left.status !== right.status,
    },
    {
      field: 'contentJson',
      label: '变量内容',
      left: prettyJson(left.contentJson),
      right: prettyJson(right.contentJson),
      changed: normalizeJsonText(left.contentJson) !== normalizeJsonText(right.contentJson),
    },
  ]
})

watch(rows, () => {
  compareIds.value = []
})

function changeTypeLabel(type: string) {
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'CREATE') return '创建'
  if (normalized === 'UPDATE') return '编辑'
  if (normalized === 'STATUS') return '状态变更'
  if (normalized === 'ROLLBACK') return '回滚'
  return type || '-'
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function formatFields(value: string | null) {
  return value ? value.split(',').filter(Boolean).join(' / ') : '-'
}

function statusLabel(value: number | null | undefined) {
  return value === 0 ? '停用' : '启用'
}

function prettyJson(value: string | null) {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function normalizeJsonText(value: string | null) {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value))
  } catch {
    return value
  }
}

function handleCompareChange(value: number[]) {
  compareIds.value = value.slice(-2)
}

function versionMetaJson(row: ParamSetVersionItem) {
  return JSON.stringify({
    paramType: row.paramType,
    paramName: row.paramName,
    status: row.status,
    sourceVersionId: row.sourceVersionId,
  })
}
</script>

<template>
  <el-drawer
    v-model="visible"
    class="config-param-version-drawer"
    title="变量集版本"
    size="860px"
  >
    <div v-loading="loading" class="config-param-version-drawer__body">
      <el-table
        v-if="rows.length"
        :data="rows"
        height="calc(100vh - 332px)"
        size="small"
      >
        <el-table-column width="52">
          <template #default="{ row }">
            <el-checkbox
              :model-value="compareIds.includes(row.id)"
              :label="row.id"
              @change="(checked: boolean) => handleCompareChange(checked ? [...compareIds, row.id] : compareIds.filter(id => id !== row.id))"
            />
          </template>
        </el-table-column>
        <el-table-column label="版本" width="96">
          <template #default="{ row }">
            <div class="config-param-version-drawer__version">
              <strong>v{{ row.versionNo }}</strong>
              <el-tag v-if="row.latest" size="small" type="success">当前</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="变更" width="112">
          <template #default="{ row }">
            <el-tag effect="light">{{ changeTypeLabel(row.changeType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="字段" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatFields(row.changedFields) }}</template>
        </el-table-column>
        <el-table-column label="操作人" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.operatorName || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }">
            <button
              type="button"
              class="config-param-version-drawer__action"
              :disabled="row.latest || rollbackingId === row.id"
              @click="emit('rollback', row)"
            >
              {{ rollbackingId === row.id ? '回滚中' : '回滚' }}
            </button>
          </template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="config-param-version-drawer__json-grid">
              <section>
                <span>版本内容</span>
                <pre>{{ prettyJson(row.contentJson) }}</pre>
              </section>
              <section>
                <span>版本信息</span>
                <pre>{{ prettyJson(versionMetaJson(row)) }}</pre>
              </section>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <section v-if="rows.length" class="config-param-version-drawer__compare">
        <header>
          <div>
            <h4>版本对比</h4>
            <p>选择两个版本后，对比名称、状态和变量内容。</p>
          </div>
          <button
            v-if="compareIds.length"
            type="button"
            class="config-param-version-drawer__action"
            @click="compareIds = []"
          >
            清空
          </button>
        </header>
        <el-empty
          v-if="compareVersions.length < 2"
          description="请勾选两个版本进行对比"
          :image-size="64"
        />
        <div v-else class="config-param-version-drawer__compare-table">
          <div class="config-param-version-drawer__compare-head">
            <span>字段</span>
            <span>v{{ compareVersions[0].versionNo }}</span>
            <span>v{{ compareVersions[1].versionNo }}</span>
          </div>
          <div
            v-for="item in compareRows"
            :key="item.field"
            class="config-param-version-drawer__compare-row"
            :class="{ 'is-changed': item.changed }"
          >
            <strong>{{ item.label }}</strong>
            <pre>{{ item.left }}</pre>
            <pre>{{ item.right }}</pre>
          </div>
        </div>
      </section>

      <el-empty
        v-else
        :description="loading ? '正在加载版本...' : '暂无版本记录'"
      />
    </div>
  </el-drawer>
</template>

<style scoped>
.config-param-version-drawer__body {
  min-height: 360px;
}

.config-param-version-drawer__body :deep(.el-checkbox__label) {
  display: none;
}

.config-param-version-drawer__version {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-param-version-drawer__action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
}

.config-param-version-drawer__action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.config-param-version-drawer__json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 10px 4px;
}

.config-param-version-drawer__json-grid section {
  min-width: 0;
}

.config-param-version-drawer__json-grid span {
  display: block;
  margin-bottom: 6px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-param-version-drawer__json-grid pre {
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

.config-param-version-drawer__compare {
  margin-top: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
  padding: 12px;
}

.config-param-version-drawer__compare header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.config-param-version-drawer__compare h4 {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}

.config-param-version-drawer__compare p {
  margin: 4px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-param-version-drawer__compare-table {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.config-param-version-drawer__compare-head,
.config-param-version-drawer__compare-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) minmax(0, 1fr);
}

.config-param-version-drawer__compare-head {
  background: var(--app-bg-soft);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.config-param-version-drawer__compare-head span,
.config-param-version-drawer__compare-row strong,
.config-param-version-drawer__compare-row pre {
  min-width: 0;
  margin: 0;
  border-right: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
  padding: 8px 10px;
}

.config-param-version-drawer__compare-head span:last-child,
.config-param-version-drawer__compare-row pre:last-child {
  border-right: 0;
}

.config-param-version-drawer__compare-row:last-child strong,
.config-param-version-drawer__compare-row:last-child pre {
  border-bottom: 0;
}

.config-param-version-drawer__compare-row strong {
  color: var(--app-text-main);
  font-size: var(--app-font-size-xs);
}

.config-param-version-drawer__compare-row pre {
  max-height: 140px;
  overflow: auto;
  background: #fff;
  color: var(--app-text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
}

.config-param-version-drawer__compare-row.is-changed pre {
  background: #fff7ed;
}
</style>
