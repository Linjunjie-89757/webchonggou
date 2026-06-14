<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, FolderOpened } from '@element-plus/icons-vue'

import {
  casePriorityOptions,
  type CaseDetail,
  type CaseDirectoryNode,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

import {
  buildSaveCasePayload,
  createCaseFormFromDetail,
  createCaseFormFromSummary,
  createDefaultCaseForm,
  type CaseDialogMode,
  type CaseForm,
  validateCaseForm,
} from './model'

type PathPickerNode = {
  key: string
  id: number | null
  name: string
  fullPath: string
  selectable: boolean
  children: PathPickerNode[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: CaseDialogMode
    caseItem?: CaseSummaryItem | null
    caseDetail?: CaseDetail | null
    directories?: CaseDirectoryWorkspace[]
    saving?: boolean
    loadingDetail?: boolean
    defaultWorkspaceCode?: string
    defaultDirectoryId?: number | null
    showNavigator?: boolean
    canGoPrev?: boolean
    canGoNext?: boolean
    currentIndex?: number
    totalCount?: number
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    directories: () => [],
    defaultWorkspaceCode: 'ALL',
    defaultDirectoryId: null,
    showNavigator: false,
    canGoPrev: false,
    canGoNext: false,
    currentIndex: 0,
    totalCount: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveCasePayload>]
  prev: []
  next: []
}>()

const form = reactive<CaseForm>(createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId))
const formError = reactive({
  message: '',
})
const modulePickerVisible = ref(false)
const modulePickerKeyword = ref('')
const modulePickerSelection = ref<number | null>(null)

const drawerTitle = computed(() => {
  if (props.mode === 'copy') {
    return '复制用例'
  }
  return props.mode === 'create' ? '新增用例' : '编辑用例'
})

const submitText = computed(() => {
  if (props.mode === 'copy') {
    return '复制'
  }
  return props.mode === 'create' ? '创建' : '保存'
})

const workspace = computed(() => props.directories.find(item => item.workspaceCode === form.workspaceCode) ?? null)

const workspaceName = computed(() => {
  return workspace.value?.workspaceName || props.caseDetail?.workspaceName || props.caseItem?.workspaceName || form.workspaceCode || '-'
})

const modulePath = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return '-'
  }
  if (form.directoryId === null) {
    return workspaceName.value
  }
  const path = resolveDirectoryPath(form.directoryId)
  return path || workspaceName.value
})

const modulePickerTree = computed<PathPickerNode[]>(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL' || !workspace.value) {
    return []
  }

  return [{
    key: `workspace:${form.workspaceCode}`,
    id: null,
    name: workspaceName.value,
    fullPath: workspaceName.value,
    selectable: false,
    children: mapDirectoryNodes(workspace.value.children),
  }]
})

const filteredModulePickerTree = computed(() => {
  const keyword = modulePickerKeyword.value.trim().toLowerCase()
  return filterPathPickerNodes(modulePickerTree.value, keyword)
})

const modulePickerSelectedPath = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return ''
  }
  if (modulePickerSelection.value === null) {
    return workspaceName.value
  }
  return resolveDirectoryPath(modulePickerSelection.value)
})

function mapDirectoryNodes(nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] {
  return nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : `${workspaceName.value} / ${node.name}`
    return {
      key: `directory:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: mapDirectoryNodes(node.children ?? [], fullPath),
    }
  })
}

function filterPathPickerNodes(nodes: PathPickerNode[], keyword: string): PathPickerNode[] {
  if (!keyword) {
    return nodes
  }

  return nodes.flatMap((node) => {
    const children = filterPathPickerNodes(node.children ?? [], keyword)
    const matched = node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    return matched || children.length
      ? [{ ...node, children }]
      : []
  })
}

function resolveDirectoryPath(directoryId: number | null) {
  if (directoryId === null) {
    return workspaceName.value
  }

  function visit(nodes: CaseDirectoryNode[], prefix: string): string {
    for (const node of nodes) {
      const path = prefix ? `${prefix} / ${node.name}` : `${workspaceName.value} / ${node.name}`
      if (node.id === directoryId) {
        return path
      }
      const childPath = visit(node.children ?? [], path)
      if (childPath) {
        return childPath
      }
    }
    return ''
  }

  return visit(workspace.value?.children ?? [], '')
}

function resetForm() {
  const nextForm =
    props.mode !== 'create' && props.caseDetail
      ? createCaseFormFromDetail(props.caseDetail, props.mode)
      : props.mode !== 'create' && props.caseItem
        ? createCaseFormFromSummary(props.caseItem, props.defaultWorkspaceCode, props.mode)
        : createDefaultCaseForm(props.defaultWorkspaceCode, props.defaultDirectoryId)

  Object.assign(form, nextForm)
  formError.message = ''
}

function openModulePicker() {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    return
  }
  modulePickerKeyword.value = ''
  modulePickerSelection.value = form.directoryId ?? null
  modulePickerVisible.value = true
}

function handleModulePickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  modulePickerSelection.value = node.id
}

function confirmModulePickerSelection() {
  form.directoryId = modulePickerSelection.value
  modulePickerVisible.value = false
}

function submit() {
  const error = validateCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveCasePayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      modulePickerSelection.value = form.directoryId ?? null
      modulePickerKeyword.value = ''
    } else {
      modulePickerVisible.value = false
    }
  },
)

watch(
  () => [props.caseItem, props.caseDetail, props.defaultWorkspaceCode, props.defaultDirectoryId],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)

watch(
  () => [form.workspaceCode, props.directories],
  () => {
    if (
      form.directoryId
      && !resolveDirectoryPath(form.directoryId)
    ) {
      form.directoryId = null
    }
  },
  { deep: true },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="720px"
    drawer-class="case-editor-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-editor-drawer__body">
      <el-form label-position="top" class="case-editor-drawer__form">
        <el-form-item label="用例名称" required class="case-editor-drawer__form-item">
          <el-input v-model="form.title" placeholder="请输入用例名称" />
        </el-form-item>

        <el-form-item label="用例模块" class="case-editor-drawer__form-item">
          <el-input
            :model-value="modulePath"
            readonly
            class="case-editor-drawer__path-input"
          >
            <template #suffix>
              <button
                type="button"
                class="case-editor-drawer__path-button"
                aria-label="修改目录"
                :disabled="!form.workspaceCode || form.workspaceCode === 'ALL'"
                @click.stop="openModulePicker"
              >
                <el-icon><FolderOpened /></el-icon>
              </button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="优先级" class="case-editor-drawer__form-item">
          <el-segmented
            v-model="form.priority"
            :options="casePriorityOptions.map(item => item.value)"
            class="case-editor-drawer__priority"
          />
        </el-form-item>

        <el-form-item label="前置条件" class="case-editor-drawer__form-item">
          <el-input v-model="form.precondition" type="textarea" :rows="3" resize="vertical" />
        </el-form-item>

        <el-form-item label="测试步骤" class="case-editor-drawer__form-item">
          <el-input v-model="form.steps" type="textarea" :rows="6" resize="vertical" />
        </el-form-item>

        <el-form-item label="预期结果" class="case-editor-drawer__form-item">
          <el-input v-model="form.expectedResult" type="textarea" :rows="4" resize="vertical" />
        </el-form-item>

        <p v-if="formError.message" class="case-editor-drawer__error">{{ formError.message }}</p>
      </el-form>
    </div>

    <template #footer>
      <div class="case-editor-drawer__footer">
        <div v-if="showNavigator" class="case-editor-drawer__nav">
          <AppButton :icon="ArrowLeft" :disabled="!canGoPrev || loadingDetail || saving" @click="emit('prev')">
            上一条
          </AppButton>
          <span class="case-editor-drawer__nav-counter">{{ currentIndex }}/{{ totalCount }}</span>
          <AppButton :disabled="!canGoNext || loadingDetail || saving" @click="emit('next')">
            下一条
            <el-icon class="case-editor-drawer__next-icon"><ArrowRight /></el-icon>
          </AppButton>
        </div>

        <div class="case-editor-drawer__submit">
          <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
          <AppButton type="primary" :loading="saving" :disabled="loadingDetail" @click="submit">
            {{ submitText }}
          </AppButton>
        </div>
      </div>
    </template>
  </AppDrawer>

  <AppDialog
    v-model="modulePickerVisible"
    title="选择保存路径"
    width="760px"
  >
    <div class="case-module-picker">
      <div class="case-module-picker__current">
        <span>当前保存路径</span>
        <strong>{{ modulePath }}</strong>
      </div>

      <el-input
        v-model="modulePickerKeyword"
        clearable
        placeholder="搜索目录名称"
      />

      <div class="case-module-picker__tree-panel">
        <div v-if="!filteredModulePickerTree.length" class="case-module-picker__empty">
          未找到匹配的目录
        </div>
        <el-tree
          v-else
          :data="filteredModulePickerTree"
          node-key="key"
          highlight-current
          :expand-on-click-node="false"
          :default-expanded-keys="form.workspaceCode ? [`workspace:${form.workspaceCode}`] : []"
          :current-node-key="modulePickerSelection != null ? `directory:${modulePickerSelection}` : undefined"
          class="case-module-picker__tree"
          @node-click="handleModulePickerNodeSelect"
        >
          <template #default="{ data }">
            <div
              class="case-module-picker__node"
              :class="{ 'is-workspace': !data.selectable }"
            >
              <span>{{ data.name }}</span>
            </div>
          </template>
        </el-tree>
      </div>

      <div class="case-module-picker__selected">
        <span>已选路径</span>
        <strong>{{ modulePickerSelectedPath || '请在上方目录树中选择保存路径' }}</strong>
      </div>
    </div>

    <template #footer>
      <AppButton @click="modulePickerVisible = false">取消</AppButton>
      <AppButton type="primary" :icon="FolderOpened" @click="confirmModulePickerSelection">
        确认修改
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-editor-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-2);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-editor-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.case-editor-drawer :deep(.el-drawer__footer) {
  padding: 0;
}

.case-editor-drawer__body {
  padding: var(--app-space-3) var(--app-space-6) 0;
}

.case-editor-drawer__form {
  display: flex;
  flex-direction: column;
}

.case-editor-drawer__form-item {
  margin-bottom: var(--app-space-5);
}

.case-editor-drawer :deep(.el-form-item__label) {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-editor-drawer :deep(.el-input__wrapper),
.case-editor-drawer :deep(.el-textarea__inner) {
  border-radius: var(--app-radius-md);
}

.case-editor-drawer :deep(.el-textarea__inner) {
  line-height: 1.7;
}

.case-editor-drawer__path-input :deep(.el-input__wrapper) {
  padding-right: 4px;
}

.case-editor-drawer__path-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
}

.case-editor-drawer__path-button:hover:not(:disabled) {
  background: var(--app-primary-soft);
}

.case-editor-drawer__path-button:disabled {
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.case-editor-drawer__priority {
  max-width: 320px;
}

.case-editor-drawer__error {
  margin: 0 0 var(--app-space-4);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.case-editor-drawer__footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.case-editor-drawer__nav,
.case-editor-drawer__submit {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
}

.case-editor-drawer__submit {
  margin-left: auto;
}

.case-editor-drawer__nav-counter {
  display: inline-flex;
  min-width: 48px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.case-editor-drawer__next-icon {
  margin-left: 4px;
}

.case-module-picker {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-module-picker__current,
.case-module-picker__selected {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.case-module-picker__current span,
.case-module-picker__selected span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

.case-module-picker__current strong,
.case-module-picker__selected strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 22px;
}

.case-module-picker__tree-panel {
  min-height: 280px;
  max-height: 360px;
  overflow: auto;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.case-module-picker__empty {
  padding: var(--app-space-8) 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-align: center;
}

.case-module-picker__node {
  display: flex;
  align-items: center;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-module-picker__node.is-workspace {
  color: var(--app-text-primary);
  font-weight: 600;
}

@media (max-width: 760px) {
  .case-editor-drawer__body {
    padding: var(--app-space-4);
  }

  .case-editor-drawer__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .case-editor-drawer__nav,
  .case-editor-drawer__submit {
    justify-content: space-between;
  }

  .case-editor-drawer__submit {
    margin-left: 0;
  }
}
</style>
