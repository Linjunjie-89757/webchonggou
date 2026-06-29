<script setup lang="ts">
import { ref } from 'vue'
import {
  MoreHorizontal as LucideMoreHorizontal,
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  Plus as LucidePlus,
} from '@lucide/vue'

import type { DirectoryNode } from './lib/apiDirectoryTree'

const props = defineProps<{
  data: DirectoryNode[]
  expandedKeys: string[]
  selectedKey: string
  renderKey: string
  loading?: boolean
}>()

const emit = defineEmits<{
  nodeClick: [node: DirectoryNode]
  nodeExpand: [node: DirectoryNode]
  nodeCollapse: [node: DirectoryNode]
  createModule: [parentId: number | null]
  renameModule: [node: DirectoryNode]
  deleteModule: [node: DirectoryNode]
  renameRequest: [node: DirectoryNode]
  deleteRequest: [node: DirectoryNode]
}>()

const treeRef = ref<{
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
  }
} | null>(null)

function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

defineExpose({
  getNode: (key: string) => treeRef.value?.getNode?.(key) ?? null,
  setCurrentKey: (key: string) => treeRef.value?.setCurrentKey?.(key),
  get store() {
    return treeRef.value?.store
  },
})
</script>

<template>
  <el-tree
    ref="treeRef"
    v-loading="props.loading"
    :key="props.renderKey"
    :data="props.data"
    node-key="key"
    :default-expanded-keys="props.expandedKeys"
    :current-node-key="props.selectedKey"
    :expand-on-click-node="false"
    highlight-current
    class="api-directory-tree"
    @node-click="(node: DirectoryNode) => emit('nodeClick', node)"
    @node-expand="(node: DirectoryNode) => emit('nodeExpand', node)"
    @node-collapse="(node: DirectoryNode) => emit('nodeCollapse', node)"
  >
    <template #default="{ data }">
      <div :class="['api-directory-node', { 'is-request': data.type === 'request', 'is-placeholder': data.type === 'placeholder' }]">
        <div class="api-directory-node__main">
          <template v-if="data.type === 'request'">
            <span :class="['api-method', requestMethodClass(data.method)]">{{ data.method }}</span>
            <span class="api-directory-node__name" :title="data.label">{{ data.label }}</span>
          </template>
          <template v-else-if="data.type === 'placeholder'">
            <span :class="['api-directory-node__placeholder-dot', { 'is-loading': data.loading }]"></span>
            <span class="api-directory-node__placeholder-text" :title="data.label">{{ data.label }}</span>
          </template>
          <template v-else>
            <span :class="['api-directory-node__folder', { 'is-open': props.expandedKeys.includes(data.key) }]">
              <LucideFolderOpen v-if="props.expandedKeys.includes(data.key)" class="api-directory-node__icon" />
              <LucideFolder v-else class="api-directory-node__icon" />
            </span>
            <span class="api-directory-node__name" :title="data.label">{{ data.label }}</span>
            <span v-if="data.type === 'workspace' || data.type === 'module'" class="api-directory-node__count">{{ data.count || 0 }}</span>
          </template>
        </div>

        <div class="api-directory-node__actions" @click.stop>
          <button
            v-if="data.type === 'workspace' || data.type === 'module'"
            type="button"
            class="api-directory-node__action"
            title="新建模块"
            @click.stop="emit('createModule', data.type === 'module' ? data.moduleId : null)"
          >
            <LucidePlus class="api-directory-node__lucide-action" />
          </button>
          <el-dropdown v-if="data.type === 'module' || data.type === 'request'" trigger="click" @click.stop>
            <button type="button" class="api-directory-node__action is-more" title="更多操作" @click.stop>
              <LucideMoreHorizontal class="api-directory-node__lucide-action" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <template v-if="data.type === 'module'">
                  <el-dropdown-item @click="emit('renameModule', data)">重命名模块</el-dropdown-item>
                  <el-dropdown-item @click="emit('deleteModule', data)">删除模块</el-dropdown-item>
                </template>
                <template v-else-if="data.type === 'request'">
                  <el-dropdown-item @click="emit('renameRequest', data)">重命名请求</el-dropdown-item>
                  <el-dropdown-item divided @click="emit('deleteRequest', data)">删除请求</el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>
  </el-tree>
</template>

<style scoped>
.api-directory-tree {
  background: transparent;
}

.api-directory-tree :deep(.el-tree-node__content) {
  min-height: 32px;
  height: auto;
  border-radius: var(--app-radius-md);
  transition: background-color 0.15s ease;
}

.api-directory-tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.api-directory-tree :deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}

.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
}

.api-directory-node {
  position: relative;
  display: flex;
  min-height: 30px;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 21px;
}

.api-directory-tree :deep(.el-tree-node__content:has(.api-directory-node.is-placeholder)) {
  min-height: 32px;
  height: 32px;
}

.api-directory-node.is-placeholder {
  min-height: 32px;
  height: 32px;
  align-items: center;
  overflow: visible;
}

.api-directory-node__main {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 7px;
}

.api-directory-node__actions {
  position: absolute;
  right: 0;
  display: flex;
  width: 0;
  height: 30px;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  padding-left: 4px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  opacity: 0;
  pointer-events: none;
  transition: width 0.15s ease, opacity 0.15s ease;
}

.api-directory-node__action {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.api-directory-node__actions .api-directory-node__action {
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node:hover .api-directory-node__actions,
.api-directory-node:focus-within .api-directory-node__actions,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__actions {
  width: auto;
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node:hover .api-directory-node__count,
.api-directory-node:focus-within .api-directory-node__count,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__count {
  visibility: hidden;
}

.api-directory-node__action:hover {
  background: #fff;
  color: var(--app-primary);
}

.api-directory-node__action.is-more {
  border-radius: 4px;
}

.api-directory-node__lucide-action {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

.api-directory-node__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-directory-node__folder {
  display: inline-flex;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.api-directory-node__icon {
  width: 16px;
  height: 16px;
  color: #60a5fa;
}

.api-directory-node__folder.is-open .api-directory-node__icon {
  color: #3b82f6;
}

.api-directory-node__count {
  flex: 0 0 auto;
  margin-left: 2px;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: 16px;
}

.api-directory-node__placeholder-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #cbd5e1;
}

.api-directory-node__placeholder-dot.is-loading {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-top-color: var(--app-primary);
  background: transparent;
  animation: api-directory-loading-spin 0.8s linear infinite;
}

@keyframes api-directory-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.api-directory-node__placeholder-text {
  color: var(--app-text-subtle);
  font-size: 12px;
}

.api-method {
  display: inline-flex;
  height: 18px;
  align-items: center;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.method-get { color: #15803d; }
.method-post { color: #ea580c; }
.method-put { color: #2563eb; }
.method-patch { color: #7c3aed; }
.method-delete { color: #dc2626; }
.method-head,
.method-options { color: #64748b; }
</style>
