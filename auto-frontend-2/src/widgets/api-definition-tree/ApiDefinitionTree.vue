<script setup lang="ts">
import { computed } from 'vue'
import { Folder, FolderOpened } from '@element-plus/icons-vue'

import type { ApiDefinitionModuleItem } from '@/entities/api-automation'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type TreeNodeType = 'root' | 'module'

interface ApiModuleTreeNode {
  id: string
  label: string
  type: TreeNodeType
  moduleId: number | null
  count: number
  children: ApiModuleTreeNode[]
}

const props = defineProps<{
  modules: ApiDefinitionModuleItem[]
  loading?: boolean
  errorMessage?: string
  selectedNodeId: string
  totalCount?: number
}>()

const emit = defineEmits<{
  select: [payload: { nodeId: string; moduleId: number | null }]
  retry: []
}>()

function mapModuleNode(node: ApiDefinitionModuleItem): ApiModuleTreeNode {
  return {
    id: `module:${node.id}`,
    label: node.name,
    type: 'module',
    moduleId: node.id,
    count: node.definitionCount,
    children: node.children.map(mapModuleNode),
  }
}

const treeData = computed<ApiModuleTreeNode[]>(() => [
  {
    id: 'root',
    label: '全部接口',
    type: 'root',
    moduleId: null,
    count: props.totalCount ?? props.modules.reduce((total, item) => total + item.definitionCount, 0),
    children: props.modules.map(mapModuleNode),
  },
])

const defaultExpandedKeys = computed(() => ['root'])

function handleNodeClick(node: ApiModuleTreeNode) {
  emit('select', {
    nodeId: node.id,
    moduleId: node.type === 'module' ? node.moduleId : null,
  })
}
</script>

<template>
  <aside class="api-definition-tree">
    <div class="api-definition-tree__header">
      <h2>接口模块</h2>
      <span v-if="loading">加载中</span>
    </div>

    <AppLoadingState v-if="loading && modules.length === 0" text="正在读取接口模块" />
    <AppEmptyState
      v-else-if="errorMessage"
      title="接口模块读取失败"
      :description="errorMessage"
      action-text="重试"
      @action="emit('retry')"
    />
    <el-tree
      v-else
      class="api-definition-tree__tree"
      :data="treeData"
      node-key="id"
      :current-node-key="selectedNodeId"
      :default-expanded-keys="defaultExpandedKeys"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div class="api-definition-tree__node">
          <el-icon class="api-definition-tree__node-icon">
            <FolderOpened v-if="data.type === 'root'" />
            <Folder v-else />
          </el-icon>
          <span class="api-definition-tree__node-label">{{ data.label }}</span>
          <span class="api-definition-tree__node-count">{{ data.count }}</span>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.api-definition-tree {
  width: 240px;
  flex: 0 0 240px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-definition-tree__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.api-definition-tree__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 700;
}

.api-definition-tree__header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-definition-tree__tree {
  max-height: calc(100dvh - 260px);
  overflow: auto;
  padding: var(--app-space-2) var(--app-space-1);
}

.api-definition-tree__tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: var(--app-radius-md);
  color: var(--app-text-secondary);
}

.api-definition-tree__tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.api-definition-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 600;
}

.api-definition-tree__node {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: var(--app-space-2);
  font-size: var(--app-font-size-sm);
}

.api-definition-tree__node-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-tree__node-count {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-definition-tree__node-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
}

@media (max-width: 980px) {
  .api-definition-tree {
    width: 100%;
    flex-basis: auto;
  }

  .api-definition-tree__tree {
    max-height: 260px;
  }
}
</style>
