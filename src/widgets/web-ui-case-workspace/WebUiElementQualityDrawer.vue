<script setup lang="ts">
import {
  formatLocatorType,
  type WebUiElementQualityIssue,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

type QualityIssueFilter = 'ALL' | 'DUPLICATE' | 'DISABLED_USED' | 'EMPTY' | 'BACKEND'
type LocalQualityIssueLevel = WebUiElementQualityIssue['level']
type LocalQualityIssueKind = 'DUPLICATE_NAME' | 'DUPLICATE_LOCATOR' | 'DISABLED_USED' | 'EMPTY_PAGE' | 'EMPTY_GROUP'

export type LocalQualityIssue = {
  id: string
  level: LocalQualityIssueLevel
  kind: LocalQualityIssueKind
  title: string
  description: string
  elementId?: number | null
  elementName?: string
  workspaceCode?: string | null
  pageId?: number | null
  groupId?: number | null
  pageName?: string
  groupName?: string | null
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  usageCount?: number
}

defineProps<{
  modelValue: boolean
  filter: QualityIssueFilter
  highCount: number
  mediumCount: number
  lowCount: number
  hasAnyIssue: boolean
  localIssues: LocalQualityIssue[]
  backendIssues: WebUiElementQualityIssue[]
  checking: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'filter-change': [filter: QualityIssueFilter]
  'focus-local': [issue: LocalQualityIssue]
  'edit-local': [issue: LocalQualityIssue]
  'clean-local': [issue: LocalQualityIssue]
  'focus-backend': [issue: WebUiElementQualityIssue]
  'edit-backend': [issue: WebUiElementQualityIssue]
  'open-references': [issue: WebUiElementQualityIssue]
  rerun: []
}>()

function formatQualityLevel(level: WebUiElementQualityIssue['level']) {
  if (level === 'HIGH') return '高'
  if (level === 'MEDIUM') return '中'
  return '低'
}

function getQualityTagType(level: WebUiElementQualityIssue['level']) {
  if (level === 'HIGH') return 'danger'
  if (level === 'MEDIUM') return 'warning'
  return 'info'
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="元素质量检查"
    size="900px"
    class="web-ui-element-quality-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-scrollbar class="web-ui-element-quality-scrollbar">
      <div class="web-ui-element-quality">
        <div class="web-ui-element-quality__summary">
          <el-tag type="danger" effect="light">高风险 {{ highCount }}</el-tag>
          <el-tag type="warning" effect="light">中风险 {{ mediumCount }}</el-tag>
          <el-tag type="info" effect="light">低风险 {{ lowCount }}</el-tag>
        </div>

        <div class="web-ui-element-quality__filters">
          <AppButton size="small" :type="filter === 'ALL' ? 'primary' : 'default'" @click="emit('filter-change', 'ALL')">
            全部
          </AppButton>
          <AppButton size="small" :type="filter === 'DUPLICATE' ? 'primary' : 'default'" @click="emit('filter-change', 'DUPLICATE')">
            重复冲突
          </AppButton>
          <AppButton size="small" :type="filter === 'DISABLED_USED' ? 'primary' : 'default'" @click="emit('filter-change', 'DISABLED_USED')">
            禁用引用
          </AppButton>
          <AppButton size="small" :type="filter === 'EMPTY' ? 'primary' : 'default'" @click="emit('filter-change', 'EMPTY')">
            空目录
          </AppButton>
          <AppButton size="small" :type="filter === 'BACKEND' ? 'primary' : 'default'" @click="emit('filter-change', 'BACKEND')">
            后端规则
          </AppButton>
        </div>

        <el-alert
          v-if="!hasAnyIssue"
          type="success"
          show-icon
          :closable="false"
          title="当前筛选范围内暂未发现元素质量问题"
        />

        <template v-else>
          <el-alert
            v-if="localIssues.length"
            type="warning"
            show-icon
            :closable="false"
            title="发现重复、冲突或空目录问题，可先定位到元素列表处理。"
          />

          <el-table
            v-if="localIssues.length"
            :data="localIssues"
            row-key="id"
            border
            empty-text="暂无冲突问题"
          >
            <el-table-column label="风险" width="92">
              <template #default="{ row }">
                <el-tag :type="getQualityTagType(row.level)" effect="light">
                  {{ formatQualityLevel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="问题" min-width="130" />
            <el-table-column label="页面 / 分组" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.pageName || '-' }} / {{ row.groupName || '-' }}</template>
            </el-table-column>
            <el-table-column label="元素" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.elementName || '-' }}</template>
            </el-table-column>
            <el-table-column label="定位器" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.locatorType ? `${formatLocatorType(row.locatorType)}：${row.locatorValue || '-'}` : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
            <el-table-column label="操作" width="168" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.elementName" link type="primary" @click="emit('focus-local', row)">定位</el-button>
                <el-button v-if="row.elementId" link type="primary" @click="emit('edit-local', row)">编辑</el-button>
                <el-button
                  v-if="row.kind === 'EMPTY_PAGE' || row.kind === 'EMPTY_GROUP'"
                  link
                  type="danger"
                  :loading="checking"
                  @click="emit('clean-local', row)"
                >
                  清理
                </el-button>
                <span v-if="!row.elementName && row.kind !== 'EMPTY_PAGE' && row.kind !== 'EMPTY_GROUP'">-</span>
              </template>
            </el-table-column>
          </el-table>

          <el-table
            v-if="backendIssues.length"
            :data="backendIssues"
            row-key="id"
            border
            empty-text="暂无质量问题"
          >
            <el-table-column label="风险" width="92">
              <template #default="{ row }">
                <el-tag :type="getQualityTagType(row.level)" effect="light">
                  {{ formatQualityLevel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="问题" min-width="120" />
            <el-table-column label="元素" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.elementName }}</template>
            </el-table-column>
            <el-table-column label="页面 / 分组" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.pageName }} / {{ row.groupName || '-' }}</template>
            </el-table-column>
            <el-table-column label="定位器" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatLocatorType(row.locatorType) }}：{{ row.locatorValue || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="引用" width="76">
              <template #default="{ row }">{{ row.usageCount }}</template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="emit('focus-backend', row)">定位</el-button>
                <el-button link type="primary" @click="emit('edit-backend', row)">编辑</el-button>
                <el-button
                  v-if="row.usageCount > 0"
                  link
                  type="primary"
                  @click="emit('open-references', row)"
                >
                  引用
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </el-scrollbar>

    <template #footer>
      <div class="web-ui-element-quality__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton type="primary" :loading="checking" @click="emit('rerun')">重新检查</AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-quality {
  display: grid;
  gap: var(--app-space-3);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-element-quality-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-element-quality-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-element-quality__summary,
.web-ui-element-quality__footer {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-quality__summary,
.web-ui-element-quality__filters {
  flex-wrap: wrap;
}

.web-ui-element-quality__footer {
  justify-content: flex-end;
}

.web-ui-element-quality__filters {
  display: flex;
  gap: var(--app-space-2);
}
</style>
