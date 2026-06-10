<script setup lang="ts">
import { computed } from 'vue'
import { Folder, FolderOpened } from '@element-plus/icons-vue'

import type { CaseDirectoryNode, CaseDirectoryWorkspace } from '@/entities/case'

type TreeNodeType = 'root' | 'workspace' | 'module'

interface CaseTreeNode {
  id: string
  label: string
  type: TreeNodeType
  workspaceCode: string
  directoryId: number | null
  children: CaseTreeNode[]
}

const props = defineProps<{
  directories: CaseDirectoryWorkspace[]
  loading?: boolean
  selectedNodeId: string
  currentWorkspaceCode?: string
}>()

const emit = defineEmits<{
  select: [payload: { nodeId: string; workspaceCode: string; directoryId: number | null }]
}>()

function mapDirectoryNode(node: CaseDirectoryNode): CaseTreeNode {
  return {
    id: `directory:${node.id}`,
    label: node.name,
    type: 'module',
    workspaceCode: node.workspaceCode,
    directoryId: node.id,
    children: node.children.map(mapDirectoryNode),
  }
}

const treeData = computed<CaseTreeNode[]>(() => [
  {
    id: 'root',
    label: '全部用例',
    type: 'root',
    workspaceCode: props.currentWorkspaceCode || 'ALL',
    directoryId: null,
    children: props.directories.map((workspace) => ({
      id: `workspace:${workspace.workspaceCode}`,
      label: workspace.workspaceName || workspace.workspaceCode,
      type: 'workspace',
      workspaceCode: workspace.workspaceCode,
      directoryId: null,
      children: workspace.children.map(mapDirectoryNode),
    })),
  },
])

const defaultExpandedKeys = computed(() => [
  'root',
  ...props.directories.map((item) => `workspace:${item.workspaceCode}`),
])

function handleNodeClick(node: CaseTreeNode) {
  emit('select', {
    nodeId: node.id,
    workspaceCode: node.type === 'root' ? (props.currentWorkspaceCode || 'ALL') : node.workspaceCode,
    directoryId: node.type === 'module' ? node.directoryId : null,
  })
}
</script>

<template>
  <aside class="case-directory-tree">
    <div class="case-directory-tree__header">
      <h2>用例目录</h2>
      <span v-if="loading">加载中</span>
    </div>

    <el-tree
      class="case-directory-tree__tree"
      :data="treeData"
      node-key="id"
      :current-node-key="selectedNodeId"
      :default-expanded-keys="defaultExpandedKeys"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div class="case-directory-tree__node">
          <el-icon class="case-directory-tree__node-icon">
            <FolderOpened v-if="data.type === 'root' || data.type === 'workspace'" />
            <Folder v-else />
          </el-icon>
          <span>{{ data.label }}</span>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.case-directory-tree {
  width: 248px;
  flex: 0 0 248px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.case-directory-tree__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 48px;
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-directory-tree__header h2 {
  margin: 0;
  font-size: var(--app-font-size-md);
  font-weight: 700;
}

.case-directory-tree__header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.case-directory-tree__tree {
  max-height: calc(100dvh - 220px);
  overflow: auto;
  padding: var(--app-space-2);
}

.case-directory-tree__node {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  font-size: var(--app-font-size-sm);
}

.case-directory-tree__node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-directory-tree__node-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
}

@media (max-width: 900px) {
  .case-directory-tree {
    width: 100%;
    flex-basis: auto;
  }

  .case-directory-tree__tree {
    max-height: 260px;
  }
}
</style>
