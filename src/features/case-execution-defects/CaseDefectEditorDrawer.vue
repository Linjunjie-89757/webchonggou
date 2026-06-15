<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  DefectAttachmentPanel,
  type DefectAttachmentPanelItem,
  defectPriorityOptions,
  defectSeverityOptions,
} from '@/entities/defect'
import DefectRichTextEditor from '@/features/defect-create-edit/DefectRichTextEditor.vue'
import type { DefectForm } from '@/features/defect-create-edit/model'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'

export type CaseDefectPendingFile = {
  id: string
  file: File
  previewUrl: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    form: DefectForm
    saving?: boolean
    canSubmit?: boolean
    pendingFiles?: CaseDefectPendingFile[]
  }>(),
  {
    saving: false,
    canSubmit: true,
    pendingFiles: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: []
  'submit-and-continue': []
  'add-files': [files: File[]]
  'remove-file': [id: string]
  'add-inline-image': [payload: { file: File; src: string }]
}>()

const uploadInput = ref<HTMLInputElement | null>(null)
const evidenceDropActive = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const attachmentPreviewUrls = computed(() => (
  props.pendingFiles.map(item => item.previewUrl).filter((item): item is string => !!item)
))

const attachmentPanelItems = computed<DefectAttachmentPanelItem[]>(() => (
  props.pendingFiles.map(item => ({
    id: item.id,
    fileName: item.file.name,
    fileSize: item.file.size,
    contentType: item.file.type,
    imageUrl: item.previewUrl || undefined,
    pending: true,
  }))
))

function openUploadPicker() {
  uploadInput.value?.click()
}

function addFiles(files: File[]) {
  if (!files.length || props.saving) {
    return
  }
  emit('add-files', files)
}

function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  if (input) {
    input.value = ''
  }
  addFiles(files)
}

function handleEvidencePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((item): item is File => !!item)
  if (!files.length) {
    return
  }
  event.preventDefault()
  addFiles(files)
}

function handleEvidenceDrop(event: DragEvent) {
  evidenceDropActive.value = false
  addFiles(Array.from(event.dataTransfer?.files ?? []))
}
</script>

<template>
  <AppDrawer
    v-model="visible"
    title="创建缺陷"
    size="1198px"
    drawer-class="case-defect-editor-drawer-host"
  >
    <div class="case-defect-editor-drawer">
      <section class="case-defect-editor-drawer__main">
        <div class="case-defect-editor-drawer__field">
          <span class="is-required">缺陷标题</span>
          <el-input
            v-model="form.title"
            maxlength="120"
            show-word-limit
            placeholder="请输入缺陷标题"
            :disabled="saving"
          />
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">缺陷描述</span>
          <DefectRichTextEditor
            v-model="form.description"
            :disabled="saving"
            @add-inline-image="emit('add-inline-image', $event)"
          />
        </div>

        <section
          class="case-defect-editor-drawer__evidence"
          :class="{ 'is-drop-active': evidenceDropActive }"
          tabindex="0"
          @paste="handleEvidencePaste"
          @dragenter.prevent="evidenceDropActive = true"
          @dragover.prevent
          @dragleave="evidenceDropActive = false"
          @drop.prevent="handleEvidenceDrop"
        >
          <div class="case-defect-editor-drawer__evidence-head">
            <div>
              <strong>附件 / 截图</strong>
              <span>点击上传，或在此区域粘贴、拖拽文件。</span>
            </div>
            <AppButton size="small" :disabled="saving" @click="openUploadPicker">上传附件</AppButton>
          </div>

          <DefectAttachmentPanel
            :items="attachmentPanelItems"
            :preview-urls="attachmentPreviewUrls"
            :show-download="false"
            empty-title="添加附件或截图"
            empty-description="当前还没有待上传附件，点击上方按钮或在此区域粘贴、拖拽文件。"
            @remove="emit('remove-file', String($event.id))"
          />
          <input ref="uploadInput" class="case-defect-editor-drawer__hidden-file" type="file" multiple @change="handleUploadChange">
        </section>
      </section>

      <aside class="case-defect-editor-drawer__side">
        <div class="case-defect-editor-drawer__field">
          <span class="is-required">优先级</span>
          <div class="case-defect-editor-drawer__priority">
            <button
              v-for="item in defectPriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': form.priority === item.value }"
              :disabled="saving"
              @click="form.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">严重级别</span>
          <el-select v-model="form.severity" :disabled="saving" placeholder="请选择严重级别">
            <el-option
              v-for="item in defectSeverityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="case-defect-editor-drawer__field">
          <span class="is-required">处理人</span>
          <AppUserSelect
            v-model="form.assigneeId"
            :workspace-code="form.workspaceCode"
            :disabled="saving"
            placeholder="请选择处理人"
          />
        </div>

        <div class="case-defect-editor-drawer__field">
          <span>标签</span>
          <AppTagInput v-model="form.tags" :disabled="saving" placeholder="输入内容后回车可直接添加标签" />
        </div>
      </aside>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="visible = false">取消</AppButton>
      <AppButton :disabled="saving || !canSubmit" @click="emit('submit-and-continue')">
        保存并继续创建
      </AppButton>
      <AppButton type="primary" :loading="saving" :disabled="!canSubmit" @click="emit('submit')">
        创建
      </AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.case-defect-editor-drawer {
  display: grid;
  min-height: 100%;
  grid-template-columns: minmax(0, 1fr) 360px;
  background: var(--app-bg-panel);
}

:global(.case-defect-editor-drawer-host .el-drawer__header) {
  margin-bottom: 0;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
}

:global(.case-defect-editor-drawer-host .el-drawer__body) {
  min-height: 0;
  padding: 0;
  overflow: auto;
}

:global(.case-defect-editor-drawer-host .el-drawer__footer) {
  padding: 0;
}

.case-defect-editor-drawer__main,
.case-defect-editor-drawer__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-5) var(--app-space-6);
}

.case-defect-editor-drawer__side {
  border-left: 1px solid var(--app-border-soft);
  background: var(--app-bg-subtle);
}

.case-defect-editor-drawer__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-defect-editor-drawer__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
}

.case-defect-editor-drawer__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.case-defect-editor-drawer__field :deep(.el-input__wrapper),
.case-defect-editor-drawer__field :deep(.el-select__wrapper) {
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}

.case-defect-editor-drawer__priority {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.case-defect-editor-drawer__priority button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-defect-editor-drawer__priority button:hover,
.case-defect-editor-drawer__priority button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-defect-editor-drawer__priority button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.case-defect-editor-drawer__evidence {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  outline: none;
}

.case-defect-editor-drawer__evidence.is-drop-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.case-defect-editor-drawer__evidence-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.case-defect-editor-drawer__evidence-head div {
  display: grid;
  gap: 3px;
}

.case-defect-editor-drawer__evidence-head strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.case-defect-editor-drawer__evidence-head span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-defect-editor-drawer__hidden-file {
  display: none;
}

@media (max-width: 1080px) {
  .case-defect-editor-drawer {
    grid-template-columns: 1fr;
  }

  .case-defect-editor-drawer__side {
    border-top: 1px solid var(--app-border-soft);
    border-left: 0;
  }
}
</style>
