<script setup lang="ts">
import { computed } from 'vue'
import { Fold, Folder, FolderOpened, MoreFilled, Plus, Search } from '@element-plus/icons-vue'

export interface AppDirectoryTreeNode {
  id: string
  label: string
  type?: string
  count?: number
  canCreate?: boolean
  canMore?: boolean
  children?: AppDirectoryTreeNode[]
  disabled?: boolean
  meta?: unknown
}

const props = withDefaults(defineProps<{
  title: string
  nodes: AppDirectoryTreeNode[]
  selectedNodeId?: string
  expandedNodeIds?: string[]
  renderKey?: number
  loading?: boolean
  search?: string
  searchPlaceholder?: string
  showCreate?: boolean
  showMore?: boolean
  showTitleCount?: boolean
  showCollapseAll?: boolean
  titleCount?: number
}>(), {
  selectedNodeId: '',
  expandedNodeIds: () => [],
  renderKey: 0,
  search: '',
  searchPlaceholder: '搜索目录',
  showCreate: true,
  showMore: true,
  showTitleCount: true,
  showCollapseAll: false,
})

const emit = defineEmits<{
  'update:search': [value: string]
  select: [node: AppDirectoryTreeNode]
  create: [node: AppDirectoryTreeNode]
  command: [payload: { command: string | number | object; node: AppDirectoryTreeNode }]
  nodeExpand: [nodeId: string]
  nodeCollapse: [nodeId: string]
  collapseAll: []
}>()

const expandedNodeIdSet = computed(() => new Set(props.expandedNodeIds))
const defaultExpandedKeys = computed(() => props.expandedNodeIds)
const titleCount = computed(() => props.titleCount ?? props.nodes.length)

function isNodeExpanded(node: AppDirectoryTreeNode) {
  return expandedNodeIdSet.value.has(node.id)
}

function handleNodeClick(node: AppDirectoryTreeNode) {
  if (!node.disabled) {
    emit('select', node)
  }
}

function handleNodeExpand(node: AppDirectoryTreeNode) {
  emit('nodeExpand', node.id)
}

function handleNodeCollapse(node: AppDirectoryTreeNode) {
  emit('nodeCollapse', node.id)
}
</script>

<template>
  <aside class="app-directory-tree">
    <div class="app-directory-tree__search">
      <el-input
        :model-value="search"
        :placeholder="searchPlaceholder"
        clearable
        :prefix-icon="Search"
        @update:model-value="emit('update:search', String($event))"
      />
    </div>

    <div class="app-directory-tree__title">
      <strong>{{ title }}</strong>
      <span v-if="showTitleCount">{{ titleCount }}</span>
      <span v-if="loading" class="app-directory-tree__loading">加载中</span>
      <el-button
        v-if="showCollapseAll"
        text
        class="app-directory-tree__title-button"
        title="收起全部子模块"
        aria-label="收起全部子模块"
        @click.stop="emit('collapseAll')"
      >
        <el-icon class="app-directory-tree__collapse-icon"><Fold /></el-icon>
      </el-button>
    </div>

    <el-tree
      :key="renderKey"
      class="app-directory-tree__tree"
      :data="nodes"
      node-key="id"
      :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
      :current-node-key="selectedNodeId"
      :default-expanded-keys="defaultExpandedKeys"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #default="{ data }">
        <div class="app-directory-tree__node">
          <div class="app-directory-tree__node-main">
            <el-icon
              class="app-directory-tree__node-icon"
              :class="{ 'app-directory-tree__node-icon--expanded': isNodeExpanded(data) }"
            >
              <FolderOpened v-if="isNodeExpanded(data)" />
              <Folder v-else />
            </el-icon>
            <span class="app-directory-tree__node-label">{{ data.label }}</span>
            <span v-if="typeof data.count === 'number'" class="app-directory-tree__node-count">{{ data.count }}</span>
          </div>

          <div class="app-directory-tree__node-actions" @click.stop>
            <el-button
              v-if="showCreate && data.canCreate !== false"
              text
              class="app-directory-tree__icon-button"
              aria-label="新建子目录"
              title="新建子目录"
              @click.stop="emit('create', data)"
            >
              <el-icon><Plus /></el-icon>
            </el-button>
            <el-dropdown
              v-if="showMore && data.canMore !== false"
              trigger="click"
              @command="(command: string | number | object) => emit('command', { command, node: data })"
            >
              <el-button
                text
                class="app-directory-tree__icon-button"
                aria-label="更多操作"
                title="更多操作"
                @click.stop
              >
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <slot name="dropdown" :node="data" />
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.app-directory-tree {
  width: 300px;
  flex: 0 0 300px;
  height: max(560px, calc(100dvh - 152px));
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
  display: flex;
  flex-direction: column;
}

.app-directory-tree__search {
  padding: 10px 16px 8px;
}

.app-directory-tree__search :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 8px;
}

.app-directory-tree__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-primary);
  font-size: 14px;
}

.app-directory-tree__title strong {
  font-weight: 700;
}

.app-directory-tree__title span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.app-directory-tree__loading {
  margin-left: auto;
}

.app-directory-tree__title-button {
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border-radius: 4px;
  color: var(--app-text-muted);
}

.app-directory-tree__loading + .app-directory-tree__title-button {
  margin-left: 4px;
}

.app-directory-tree__title-button:hover,
.app-directory-tree__title-button:focus-visible {
  background: var(--app-border);
  color: var(--app-text-primary);
}

.app-directory-tree__collapse-icon {
  color: inherit;
}

.app-directory-tree__tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 10px 20px;
  background: #ffffff;
  --el-tree-node-hover-bg-color: transparent;
  --el-tree-text-color: var(--app-text-primary);
  --el-tree-expand-icon-color: var(--app-text-subtle);
}

.app-directory-tree__tree :deep(.el-tree-node) {
  margin-top: 2px;
}

.app-directory-tree__tree :deep(.el-tree-node:first-child) {
  margin-top: 0;
}

.app-directory-tree__tree :deep(.el-tree-node__content) {
  min-height: 32px;
  height: 32px;
  padding-right: 6px;
  border-radius: 8px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  transition: background-color 150ms ease, color 150ms ease;
}

.app-directory-tree__tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.app-directory-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}

.app-directory-tree__tree :deep(.el-tree-node__children) {
  margin-top: 2px;
}

.app-directory-tree__tree :deep(.el-tree-node__expand-icon) {
  width: 14px;
  height: 14px;
  margin-right: 4px;
  color: var(--app-text-subtle);
  font-size: 14px;
}

.app-directory-tree__node {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--app-font-size-sm);
}

.app-directory-tree__node-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.app-directory-tree__node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-directory-tree__node-count {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.app-directory-tree__node-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: #60a5fa;
  font-size: 16px;
}

.app-directory-tree__node-icon--expanded {
  color: var(--app-primary);
}

.app-directory-tree__node-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  margin-left: 4px;
  opacity: 0;
  transition: opacity 150ms ease;
}

.app-directory-tree__tree :deep(.el-tree-node__content:hover) .app-directory-tree__node-actions,
.app-directory-tree__tree :deep(.el-tree-node__content:focus-within) .app-directory-tree__node-actions {
  opacity: 1;
}

.app-directory-tree__icon-button {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  color: var(--app-text-muted);
}

.app-directory-tree__icon-button:hover {
  background: var(--app-border);
  color: var(--app-text-primary);
}

@media (max-width: 900px) {
  .app-directory-tree {
    width: 100%;
    height: auto;
    flex-basis: auto;
  }

  .app-directory-tree__tree {
    max-height: 260px;
  }
}
</style>
