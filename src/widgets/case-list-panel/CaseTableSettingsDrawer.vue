<script setup lang="ts">
import { Rank } from '@element-plus/icons-vue'

import type { CaseTableColumnKey } from './useCaseTableSettings'

type DrawerColumn = {
  key: CaseTableColumnKey
  label: string
  required: boolean
  visible: boolean
  draggable: boolean
}

defineProps<{
  modelValue: boolean
  columns: DrawerColumn[]
  draggingKey?: CaseTableColumnKey | null
  pageSize: number
  pageSizeOptions: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggleColumn: [key: CaseTableColumnKey, value: boolean | string | number]
  updatePageSize: [value: number]
  dragStart: [key: CaseTableColumnKey]
  dragEnd: []
  dropColumn: [targetKey: CaseTableColumnKey]
  reset: []
}>()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="表格设置"
    size="420px"
    append-to-body
    drawer-class="case-table-settings-drawer-host"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <div class="case-table-settings-drawer">
      <section class="case-table-settings-drawer__section">
        <div class="case-table-settings-drawer__section-head">
          <div>
            <h4>表头设置</h4>
            <p>支持显示控制、拖拽排序和本地记忆</p>
          </div>
          <el-button text @click="emit('reset')">恢复默认</el-button>
        </div>

        <div class="case-table-settings-drawer__list">
          <div
            v-for="column in columns"
            :key="column.key"
            :class="[
              'case-table-settings-drawer__item',
              { 'is-dragging': draggingKey === column.key },
            ]"
            :draggable="column.draggable"
            @dragstart="emit('dragStart', column.key)"
            @dragend="emit('dragEnd')"
            @dragover.prevent
            @drop.prevent="emit('dropColumn', column.key)"
          >
            <div class="case-table-settings-drawer__item-main">
              <el-icon
                v-if="column.draggable"
                class="case-table-settings-drawer__drag-handle"
              >
                <Rank />
              </el-icon>
              <div class="case-table-settings-drawer__item-text">
                <span>{{ column.label }}</span>
                <small v-if="column.required">必显</small>
              </div>
            </div>
            <el-switch
              :model-value="column.required ? true : column.visible"
              :disabled="column.required"
              @change="(value: boolean | string | number) => emit('toggleColumn', column.key, value)"
            />
          </div>
        </div>
      </section>

      <section class="case-table-settings-drawer__section">
        <div class="case-table-settings-drawer__section-head">
          <div>
            <h4>分页设置</h4>
            <p>调整用例列表每页显示数量，设置会保存在当前浏览器</p>
          </div>
        </div>

        <el-select
          class="case-table-settings-drawer__page-size"
          :model-value="pageSize"
          @change="(value: number) => emit('updatePageSize', value)"
        >
          <el-option
            v-for="option in pageSizeOptions"
            :key="option"
            :label="`${option} 条/页`"
            :value="option"
          />
        </el-select>
      </section>
    </div>
  </el-drawer>
</template>

<style scoped>
.case-table-settings-drawer {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.case-table-settings-drawer__section {
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.case-table-settings-drawer__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.case-table-settings-drawer__section-head h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: 22px;
}

.case-table-settings-drawer__section-head p {
  margin: 4px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

.case-table-settings-drawer__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  margin-top: var(--app-space-4);
}

.case-table-settings-drawer__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 42px;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-table-settings-drawer__item.is-dragging {
  opacity: 0.64;
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.case-table-settings-drawer__item-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.case-table-settings-drawer__drag-handle {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  cursor: grab;
}

.case-table-settings-drawer__item-text {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.case-table-settings-drawer__item-text small {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.case-table-settings-drawer__page-size {
  width: 180px;
  margin-top: var(--app-space-4);
}
</style>
