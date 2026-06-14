<script setup lang="ts">
import { GripVertical } from '@lucide/vue'

import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

export interface AppTableColumnSettingsItem {
  key: string
  label: string
  required: boolean
  visible: boolean
  draggable: boolean
}

withDefaults(defineProps<{
  modelValue: boolean
  columns: AppTableColumnSettingsItem[]
  draggingKey?: string | null
  title?: string
}>(), {
  draggingKey: null,
  title: '字段设置',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggleColumn: [key: string, value: boolean | string | number]
  dragStart: [key: string]
  dragEnd: []
  dropColumn: [targetKey: string]
  reset: []
}>()
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="title"
    size="420px"
    drawer-class="app-table-column-settings-drawer-host"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="app-table-column-settings-drawer">
      <section class="app-table-column-settings-drawer__section">
        <div class="app-table-column-settings-drawer__section-head">
          <div>
            <h4>列表字段</h4>
            <p>支持显示控制和字段排序，必显字段保持在前侧。</p>
          </div>
          <AppButton size="small" @click="emit('reset')">恢复默认</AppButton>
        </div>

        <div class="app-table-column-settings-drawer__list">
          <div
            v-for="column in columns"
            :key="column.key"
            :class="[
              'app-table-column-settings-drawer__item',
              { 'is-dragging': draggingKey === column.key },
            ]"
            :draggable="column.draggable"
            @dragstart="emit('dragStart', column.key)"
            @dragend="emit('dragEnd')"
            @dragover.prevent
            @drop.prevent="emit('dropColumn', column.key)"
          >
            <div class="app-table-column-settings-drawer__item-main">
              <span
                v-if="column.draggable"
                class="app-table-column-settings-drawer__drag-handle"
                aria-hidden="true"
              >
                <GripVertical :size="15" />
              </span>
              <div class="app-table-column-settings-drawer__item-text">
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
    </div>
  </AppDrawer>
</template>

<style scoped>
.app-table-column-settings-drawer {
  padding: var(--app-space-5) var(--app-space-6);
}

.app-table-column-settings-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.app-table-column-settings-drawer__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.app-table-column-settings-drawer__section-head h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  line-height: 24px;
}

.app-table-column-settings-drawer__section-head p {
  margin: 4px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

.app-table-column-settings-drawer__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.app-table-column-settings-drawer__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 46px;
  padding: 0 var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.app-table-column-settings-drawer__item.is-dragging {
  border-color: #bfdbfe;
  background: #f8fbff;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.08);
}

.app-table-column-settings-drawer__item-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
}

.app-table-column-settings-drawer__drag-handle {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  cursor: grab;
}

.app-table-column-settings-drawer__item-text {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.app-table-column-settings-drawer__item-text small {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}
</style>
