<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { Folder as LucideFolder, FolderOpen as LucideFolderOpen } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import type { DirectoryNode } from './lib/apiDirectoryTree'
import {
  type ApiDefinitionSaveDraft,
  buildApiDefinitionSaveDraft,
  validateApiDefinitionSaveDraft,
} from './lib/apiDefinitionSaveDialog'

const props = defineProps<{
  modelValue: boolean
  currentName?: string | null
  requestPath?: string | null
  currentDirectoryName?: string | null
  selectedDirectoryName?: string | null
  directoryTree: DirectoryNode[]
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [draft: ApiDefinitionSaveDraft]
}>()

const form = reactive<ApiDefinitionSaveDraft>({
  name: '',
  directoryName: '',
})
const keyword = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const selectableDirectoryTree = computed(() => {
  const filterText = keyword.value.trim().toLowerCase()
  const normalize = (value?: string | null) => (value || '').toLowerCase()

  const walk = (nodes: DirectoryNode[]): DirectoryNode[] => {
    return nodes
      .filter(node => node.type === 'workspace' || node.type === 'module')
      .map((node) => {
        const children = walk(node.children || [])
        const matched = !filterText
          || normalize(node.label).includes(filterText)
          || normalize(node.fullPath).includes(filterText)
        if (!matched && !children.length) {
          return null
        }
        return {
          ...node,
          children,
        }
      })
      .filter((node): node is DirectoryNode => Boolean(node))
  }

  return walk(props.directoryTree || [])
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const draft = buildApiDefinitionSaveDraft({
      currentName: props.currentName,
      requestPath: props.requestPath,
      currentDirectoryName: props.currentDirectoryName,
      selectedDirectoryName: props.selectedDirectoryName,
    })
    form.name = draft.name
    form.directoryName = draft.directoryName
    keyword.value = ''
  },
)

function closeDialog() {
  if (props.submitting) return
  visible.value = false
}

function selectDirectory(node: DirectoryNode) {
  if (node.type !== 'module') return
  form.directoryName = (node.fullPath || '').trim()
}

function confirmSave() {
  const draft = {
    name: form.name.trim(),
    directoryName: form.directoryName.trim(),
  }
  const validation = validateApiDefinitionSaveDraft(draft)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    return
  }
  emit('confirm', draft)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="保存接口"
    width="520px"
    class="api-definition-save-dialog"
    :close-on-click-modal="!props.submitting"
    :close-on-press-escape="!props.submitting"
    @close="closeDialog"
  >
    <div class="api-definition-save-dialog__form">
      <label class="api-definition-save-dialog__label">名称 <span>*</span></label>
      <el-input
        v-model="form.name"
        placeholder="请输入接口名称"
        :disabled="props.submitting"
        maxlength="120"
        show-word-limit
      />

      <label class="api-definition-save-dialog__label">目录 <span>*</span></label>
      <el-input
        v-model="keyword"
        placeholder="搜索目录"
        :prefix-icon="Search"
        :disabled="props.submitting"
      />
      <div class="api-definition-save-dialog__tree">
        <el-tree
          :data="selectableDirectoryTree"
          node-key="key"
          :default-expand-all="Boolean(keyword)"
          :expand-on-click-node="false"
          empty-text="暂无可选目录，请先在左侧新建模块"
          @node-click="selectDirectory"
        >
          <template #default="{ data }">
            <div
              :class="[
                'api-definition-save-dialog__node',
                { 'is-selected': data.type === 'module' && data.fullPath === form.directoryName },
                { 'is-workspace': data.type === 'workspace' },
              ]"
            >
              <span class="api-definition-save-dialog__folder">
                <LucideFolderOpen v-if="data.children?.length" class="api-definition-save-dialog__icon" />
                <LucideFolder v-else class="api-definition-save-dialog__icon" />
              </span>
              <span class="api-definition-save-dialog__node-name" :title="data.fullPath || data.label">
                {{ data.label }}
              </span>
            </div>
          </template>
        </el-tree>
      </div>
      <div class="api-definition-save-dialog__selected">
        保存到：<strong>{{ form.directoryName || '请选择目录' }}</strong>
      </div>
    </div>

    <template #footer>
      <button type="button" class="api-definition-save-dialog__plain" :disabled="props.submitting" @click="closeDialog">
        取消
      </button>
      <button type="button" class="api-definition-save-dialog__primary" :disabled="props.submitting" @click="confirmSave">
        {{ props.submitting ? '保存中' : '保存' }}
      </button>
    </template>
  </el-dialog>
</template>

<style scoped>
.api-definition-save-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-definition-save-dialog__label {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-definition-save-dialog__label span {
  color: var(--app-danger);
}

.api-definition-save-dialog__tree {
  height: 280px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  padding: 6px;
}

.api-definition-save-dialog__tree :deep(.el-tree) {
  background: transparent;
}

.api-definition-save-dialog__tree :deep(.el-tree-node__content) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
}

.api-definition-save-dialog__tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.api-definition-save-dialog__node {
  display: inline-flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.api-definition-save-dialog__node.is-selected {
  color: var(--app-primary);
  font-weight: 600;
}

.api-definition-save-dialog__node.is-workspace {
  font-weight: 600;
}

.api-definition-save-dialog__folder {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--app-text-muted);
}

.api-definition-save-dialog__icon {
  width: 16px;
  height: 16px;
}

.api-definition-save-dialog__node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-save-dialog__selected {
  min-height: 24px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.api-definition-save-dialog__selected strong {
  color: var(--app-text-primary);
  font-weight: 600;
}

.api-definition-save-dialog__plain,
.api-definition-save-dialog__primary {
  min-width: 72px;
  height: 32px;
  border-radius: var(--app-radius-md);
  padding: 0 14px;
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-definition-save-dialog__plain {
  border: 1px solid var(--app-border);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
}

.api-definition-save-dialog__plain:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.api-definition-save-dialog__primary {
  border: 1px solid var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}

.api-definition-save-dialog__plain:disabled,
.api-definition-save-dialog__primary:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}
</style>
