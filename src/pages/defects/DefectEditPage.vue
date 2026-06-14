<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import {
  DefectAttachmentPanel,
  type DefectAttachmentPanelItem,
  defectApi,
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectAttachment,
  type DefectCaseSummary,
  type DefectDetail,
} from '@/entities/defect'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import DefectCaseAssociateDialog from '@/features/defect-case-associate/DefectCaseAssociateDialog.vue'
import DefectRichTextEditor from '@/features/defect-create-edit/DefectRichTextEditor.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'
import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  createDefectFormFromDetail,
  type DefectForm,
  validateDefectForm,
} from '@/features/defect-create-edit/model'

type PendingDefectFile = {
  id: string
  file: File
  previewUrl: string | null
}

const route = useRoute()
const router = useRouter()

const form = reactive<DefectForm>(createDefaultDefectForm())
const detail = ref<DefectDetail | null>(null)
const workspaces = ref<WorkspaceItem[]>([])
const caseOptions = ref<CaseSummaryItem[]>([])
const selectedCases = ref<Array<CaseSummaryItem | DefectCaseSummary>>([])
const loading = ref(false)
const saving = ref(false)
const optionsLoading = ref(false)
const caseOptionsLoading = ref(false)
const caseAssociateVisible = ref(false)
const errorMessage = ref('')
const formError = ref('')
const optionErrorMessage = ref('')
const inlineImages = ref<Array<{ file: File; src: string }>>([])
const pendingFiles = ref<PendingDefectFile[]>([])
const existingAttachments = ref<DefectAttachment[]>([])
const attachmentImageUrls = ref<Record<number, string>>({})
const uploadInput = ref<HTMLInputElement | null>(null)
const evidenceDropActive = ref(false)
const initialSnapshot = ref('')
const suppressLeaveGuard = ref(false)
const deletingAttachmentIds = ref<Set<number>>(new Set())

const defectId = computed(() => {
  const rawId = route.params.id
  const id = Array.isArray(rawId) ? Number(rawId[0]) : Number(rawId)
  return Number.isFinite(id) ? id : null
})

const isCreateMode = computed(() => route.name === 'bug-create')

const routeWorkspaceCode = computed(() => {
  const rawWorkspace = route.query.workspace
  const workspaceCode = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace
  return workspaceCode || 'ALL'
})

const pageTitle = computed(() => (isCreateMode.value ? '新增缺陷' : '编辑缺陷'))
const primaryActionText = computed(() => (isCreateMode.value ? '创建' : '保存'))
const canSubmit = computed(() => !loading.value && !errorMessage.value)
const pendingImageFiles = computed(() => pendingFiles.value.filter(item => item.previewUrl))
const existingImageAttachments = computed(() => existingAttachments.value.filter(item => isImageAttachment(item)))
const attachmentPreviewUrls = computed(() => [
  ...existingImageAttachments.value.map(item => getAttachmentImageUrl(item)),
  ...pendingImageFiles.value.map(item => item.previewUrl || ''),
].filter(Boolean))
const attachmentPanelItems = computed<DefectAttachmentPanelItem[]>(() => [
  ...existingAttachments.value.map(item => ({
    id: item.id,
    fileName: item.fileName,
    fileSize: item.fileSize,
    uploadedByName: item.uploadedByName,
    createdAt: item.createdAt,
    contentType: item.contentType,
    imageUrl: isImageAttachment(item) ? getAttachmentImageUrl(item) : undefined,
  })),
  ...pendingFiles.value.map(item => ({
    id: item.id,
    fileName: item.file.name,
    fileSize: item.file.size,
    contentType: item.file.type,
    imageUrl: item.previewUrl || undefined,
    pending: true,
  })),
])
const isDirty = computed(() => buildDirtySnapshot() !== initialSnapshot.value)

const selectedCaseLabel = computed(() => {
  if (!selectedCases.value.length) {
    return '未关联用例'
  }

  return `已关联 ${selectedCases.value.length} 条用例`
})

function getConcreteWorkspaces() {
  return workspaces.value.filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
}

function getWorkspaceLabel(item: WorkspaceItem) {
  return item.workspaceName || item.workspaceCode
}

function isImageAttachment(item: DefectAttachment) {
  return Boolean(item.contentType?.startsWith('image/'))
}

function getAttachmentImageUrl(item: DefectAttachment) {
  return attachmentImageUrls.value[item.id] || ''
}

function revokeAttachmentImageUrls() {
  Object.values(attachmentImageUrls.value).forEach((url) => {
    URL.revokeObjectURL(url)
  })
  attachmentImageUrls.value = {}
}

async function loadAttachmentImageUrls(nextDetail: DefectDetail | null) {
  revokeAttachmentImageUrls()
  if (!nextDetail) {
    return
  }
  const nextUrls: Record<number, string> = {}
  for (const attachment of (nextDetail.attachments ?? []).filter(isImageAttachment)) {
    try {
      const blob = await defectApi.downloadDefectAttachment(nextDetail.workspaceCode, nextDetail.id, attachment.id)
      nextUrls[attachment.id] = URL.createObjectURL(blob)
    } catch {
      // Keep broken thumbnails local to the image card; download still remains available.
    }
  }
  attachmentImageUrls.value = nextUrls
}

function buildDirtySnapshot() {
  return JSON.stringify({
    workspaceCode: form.workspaceCode,
    title: form.title,
    description: form.description,
    priority: form.priority,
    severity: form.severity,
    assigneeId: form.assigneeId,
    relatedCaseId: form.relatedCaseId,
    relatedCaseIds: [...form.relatedCaseIds],
    tags: [...form.tags],
    pendingFiles: pendingFiles.value.map(item => item.file.name),
    inlineImages: inlineImages.value.map(item => item.src),
  })
}

function markClean() {
  initialSnapshot.value = buildDirtySnapshot()
}

function resetCreateForm(keepDefaults = true) {
  const preserved = {
    workspaceCode: form.workspaceCode,
    priority: form.priority,
    severity: form.severity,
    assigneeId: form.assigneeId,
  }
  Object.assign(form, createDefaultDefectForm(keepDefaults ? preserved.workspaceCode : 'ALL'))
  if (keepDefaults) {
    form.priority = preserved.priority
    form.severity = preserved.severity
    form.assigneeId = preserved.assigneeId
  }
  formError.value = ''
  clearPendingFiles()
  clearInlineImages()
  markClean()
}

function addInlineImage(payload: { file: File; src: string }) {
  inlineImages.value = [...inlineImages.value, payload]
}

function clearInlineImages() {
  inlineImages.value.forEach((item) => {
    URL.revokeObjectURL(item.src)
  })
  inlineImages.value = []
}

function addPendingFiles(files: File[]) {
  const nextFiles = files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  }))
  pendingFiles.value = [...pendingFiles.value, ...nextFiles]
}

function removePendingFile(id: string) {
  const target = pendingFiles.value.find(item => item.id === id)
  if (target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  pendingFiles.value = pendingFiles.value.filter(item => item.id !== id)
}

function clearPendingFiles() {
  pendingFiles.value.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  pendingFiles.value = []
}

function openUploadPicker() {
  uploadInput.value?.click()
}

function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  if (input) {
    input.value = ''
  }
  addPendingFiles(files)
}

function handleEvidencePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((item): item is File => !!item)
  if (!files.length || saving.value) {
    return
  }
  event.preventDefault()
  addPendingFiles(files)
}

function handleEvidenceDrop(event: DragEvent) {
  evidenceDropActive.value = false
  if (saving.value) {
    return
  }
  addPendingFiles(Array.from(event.dataTransfer?.files ?? []))
}

async function downloadAttachment(item: DefectAttachment) {
  if (!detail.value) {
    return
  }
  try {
    const blob = await defectApi.downloadDefectAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.fileName || 'attachment'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteAttachment(item: DefectAttachment) {
  if (!detail.value) {
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除附件“${item.fileName}”吗？`, '删除附件', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
    const nextIds = new Set(deletingAttachmentIds.value)
    nextIds.add(item.id)
    deletingAttachmentIds.value = nextIds
    await defectApi.deleteDefectAttachment(detail.value.workspaceCode, detail.value.id, item.id)
    existingAttachments.value = existingAttachments.value.filter(attachment => attachment.id !== item.id)
    const removedImageUrl = attachmentImageUrls.value[item.id]
    if (removedImageUrl) {
      URL.revokeObjectURL(removedImageUrl)
      const nextUrls = { ...attachmentImageUrls.value }
      delete nextUrls[item.id]
      attachmentImageUrls.value = nextUrls
    }
    markClean()
    ElMessage.success('附件已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    const nextIds = new Set(deletingAttachmentIds.value)
    nextIds.delete(item.id)
    deletingAttachmentIds.value = nextIds
  }
}

function handleAttachmentPanelDownload(item: DefectAttachmentPanelItem) {
  if (item.pending) {
    return
  }
  const matched = existingAttachments.value.find(attachment => attachment.id === item.id)
  if (matched) {
    void downloadAttachment(matched)
  }
}

function handleAttachmentPanelRemove(item: DefectAttachmentPanelItem) {
  if (item.pending) {
    removePendingFile(String(item.id))
    return
  }
  const matched = existingAttachments.value.find(attachment => attachment.id === item.id)
  if (matched) {
    void deleteAttachment(matched)
  }
}

function resolveInitialWorkspaceCode(items: WorkspaceItem[]) {
  const concreteWorkspaces = items.filter(item => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
  if (routeWorkspaceCode.value !== 'ALL' && concreteWorkspaces.some(item => item.workspaceCode === routeWorkspaceCode.value)) {
    return routeWorkspaceCode.value
  }
  const selected = concreteWorkspaces.find(item => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || concreteWorkspaces[0]?.workspaceCode || ''
}

function findInlineImageBySrc(src: string) {
  return inlineImages.value.find(item => item.src === src) || null
}

async function uploadInlineImages(defectIdValue: number, workspaceCode: string, html: string) {
  if (!inlineImages.value.length || !html.trim()) {
    clearInlineImages()
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild as HTMLElement | null
  if (!container) {
    clearInlineImages()
    return html
  }

  const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
  for (const image of images) {
    const src = image.getAttribute('src') || ''
    if (!/^blob:|^data:/i.test(src)) {
      continue
    }
    const matched = findInlineImageBySrc(src)
    if (!matched) {
      continue
    }
    const [attachment] = await defectApi.uploadDefectAttachments(workspaceCode, defectIdValue, [matched.file])
    const nextSrc = attachment.downloadUrl || `/api/bugs/${defectIdValue}/attachments/${attachment.id}/download`
    image.setAttribute('src', nextSrc)
  }

  clearInlineImages()
  return container.innerHTML
}

async function uploadPendingAttachments(defectIdValue: number, workspaceCode: string) {
  if (!pendingFiles.value.length) {
    return []
  }
  const uploaded = await defectApi.uploadDefectAttachments(workspaceCode, defectIdValue, pendingFiles.value.map(item => item.file))
  clearPendingFiles()
  return uploaded
}

async function loadOptions() {
  optionsLoading.value = true
  optionErrorMessage.value = ''
  try {
    const workspaceList = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = workspaceList
    if (isCreateMode.value && (!form.workspaceCode || form.workspaceCode === 'ALL')) {
      form.workspaceCode = resolveInitialWorkspaceCode(workspaceList)
      await loadCaseOptions(form.workspaceCode)
    }
  } catch (error) {
    optionErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    optionsLoading.value = false
  }
}

async function loadCaseOptions(workspaceCode: string) {
  if (!workspaceCode || workspaceCode === 'ALL') {
    caseOptions.value = []
    selectedCases.value = []
    return
  }

  caseOptionsLoading.value = true
  try {
    const page = await caseApi.getCases(workspaceCode, {
      pageNo: 1,
      pageSize: 50,
    })
    caseOptions.value = Array.isArray(page.items) ? page.items : []
    if (!selectedCases.value.length && form.relatedCaseIds.length) {
      selectedCases.value = caseOptions.value.filter(item => form.relatedCaseIds.includes(String(item.id)))
    }
  } catch {
    caseOptions.value = []
  } finally {
    caseOptionsLoading.value = false
  }
}

function openCaseAssociateDialog() {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') {
    ElMessage.warning('请先选择具体工作空间')
    return
  }

  caseAssociateVisible.value = true
}

function handleCaseAssociated(caseIds: number[]) {
  form.relatedCaseIds = caseIds.map(String)
  form.relatedCaseId = form.relatedCaseIds[0] ?? ''
  selectedCases.value = [
    ...selectedCases.value.filter(item => caseIds.includes(item.id)),
    ...caseOptions.value.filter(item => caseIds.includes(item.id) && !selectedCases.value.some(selected => selected.id === item.id)),
  ]
  caseAssociateVisible.value = false
}

function clearAssociatedCase() {
  form.relatedCaseId = ''
  form.relatedCaseIds = []
  selectedCases.value = []
}

async function loadDefectDetail() {
  if (isCreateMode.value) {
    detail.value = null
    errorMessage.value = ''
    return
  }

  if (!defectId.value) {
    errorMessage.value = '缺陷不存在或链接参数无效。'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const nextDetail = await defectApi.getDefectDetail(routeWorkspaceCode.value, defectId.value)
    detail.value = nextDetail
    existingAttachments.value = nextDetail.attachments ?? []
    await loadAttachmentImageUrls(nextDetail)
    Object.assign(form, createDefectFormFromDetail(nextDetail))
    await loadCaseOptions(nextDetail.workspaceCode)
    selectedCases.value = nextDetail.relatedCases?.length
      ? nextDetail.relatedCases
      : caseOptions.value.filter(item => form.relatedCaseIds.includes(String(item.id)))
    markClean()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function confirmLeave() {
  if (!isDirty.value || suppressLeaveGuard.value) {
    return true
  }
  try {
    await ElMessageBox.confirm('系统不会保存尚未提交的修改，确认离开吗？', '离开此页面？', {
      type: 'warning',
      confirmButtonText: '离开',
      cancelButtonText: '留下',
    })
    return true
  } catch {
    return false
  }
}

async function goBack() {
  if (!await confirmLeave()) {
    return
  }
  suppressLeaveGuard.value = true
  const workspaceCode = detail.value?.workspaceCode || form.workspaceCode || routeWorkspaceCode.value
  try {
    await router.push({
      path: '/bugs',
      query: workspaceCode ? { workspace: workspaceCode } : undefined,
    })
  } catch {
    suppressLeaveGuard.value = false
  }
}

async function submit(keepCreating = false) {
  const error = validateDefectForm(form)
  if (error) {
    formError.value = error
    return
  }
  if (!isCreateMode.value && !defectId.value) {
    formError.value = '缺陷不存在或链接参数无效。'
    return
  }

  formError.value = ''
  saving.value = true
  try {
    const workspaceCode = detail.value?.workspaceCode || form.workspaceCode || routeWorkspaceCode.value
    const payload = buildSaveDefectPayload(form)
    if (isCreateMode.value) {
      const created = await defectApi.createDefect(workspaceCode, payload)
      const description = await uploadInlineImages(created.id, workspaceCode, payload.description)
      if (description !== payload.description) {
        await defectApi.updateDefect(workspaceCode, created.id, {
          ...payload,
          description,
        })
      }
      if (form.relatedCaseIds.length !== (payload.relatedCaseId ? 1 : 0)) {
        await defectApi.replaceDefectCases(workspaceCode, created.id, {
          caseIds: form.relatedCaseIds.map(Number).filter(Number.isFinite),
        })
      }
      await uploadPendingAttachments(created.id, workspaceCode)
      ElMessage.success('缺陷创建成功')
      if (keepCreating) {
        resetCreateForm(true)
        return
      }
    } else if (defectId.value) {
      const description = await uploadInlineImages(defectId.value, workspaceCode, payload.description)
      const updated = await defectApi.updateDefect(workspaceCode, defectId.value, {
        ...payload,
        description,
      })
      const uploaded = await uploadPendingAttachments(defectId.value, workspaceCode)
      if (form.relatedCaseIds.length !== (payload.relatedCaseId ? 1 : 0)) {
        await defectApi.replaceDefectCases(workspaceCode, defectId.value, {
          caseIds: form.relatedCaseIds.map(Number).filter(Number.isFinite),
        })
      }
      existingAttachments.value = [...(updated.attachments ?? existingAttachments.value), ...uploaded]
      await loadAttachmentImageUrls({
        ...updated,
        attachments: existingAttachments.value,
      })
      ElMessage.success('缺陷更新成功')
    }
    markClean()
    suppressLeaveGuard.value = true
    await goBack()
  } catch (requestError) {
    formError.value = getRequestErrorMessage(requestError)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void (async () => {
    await Promise.all([loadOptions(), loadDefectDetail()])
    if (isCreateMode.value) {
      markClean()
    }
  })()
})

onBeforeUnmount(() => {
  clearPendingFiles()
  clearInlineImages()
  revokeAttachmentImageUrls()
})

onBeforeRouteLeave(async () => {
  if (suppressLeaveGuard.value) {
    return true
  }
  return confirmLeave()
})

watch(
  () => form.workspaceCode,
  (workspaceCode, oldWorkspaceCode) => {
    if (!isCreateMode.value || workspaceCode === oldWorkspaceCode) {
      return
    }
    form.relatedCaseId = ''
    form.assigneeId = ''
    void loadCaseOptions(workspaceCode)
  },
)
</script>

<template>
  <section class="defect-edit-page">
    <div class="defect-edit-page__shell">
      <header class="defect-edit-page__header">
        <div class="defect-edit-page__backbar">
          <el-button text :icon="ArrowLeft" class="defect-edit-page__back-button" @click="goBack">
            返回缺陷管理
          </el-button>
        </div>
        <div class="defect-edit-page__titlebar">
          <div>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>
      </header>

      <main class="defect-edit-page__content">
        <AppLoadingState v-if="loading" title="正在加载缺陷详情" description="请稍候，系统正在读取最新缺陷信息。" />
        <div v-else-if="errorMessage" class="defect-edit-page__error">
          <span>{{ errorMessage }}</span>
          <AppButton size="small" @click="loadDefectDetail">閲嶈瘯</AppButton>
        </div>

        <div v-else class="defect-edit-page__form-surface">
          <section class="defect-edit-page__main">
            <div class="defect-edit-page__field">
              <span class="is-required">缺陷标题</span>
              <el-input
                v-model="form.title"
                maxlength="120"
                show-word-limit
                placeholder="请输入缺陷标题"
                :disabled="saving"
              />
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">缺陷描述</span>
              <DefectRichTextEditor
                v-model="form.description"
                :disabled="saving"
                @add-inline-image="addInlineImage"
              />
            </div>

            <section
              class="defect-edit-page__evidence"
              :class="{ 'is-drop-active': evidenceDropActive }"
              tabindex="0"
              @paste="handleEvidencePaste"
              @dragenter.prevent="evidenceDropActive = true"
              @dragover.prevent
              @dragleave="evidenceDropActive = false"
              @drop.prevent="handleEvidenceDrop"
            >
              <div class="defect-edit-page__evidence-head">
                <div>
                  <strong>附件 / 截图</strong>
                  <span>点击上传，或在此区域粘贴、拖拽文件。</span>
                </div>
                <AppButton size="small" :disabled="saving" @click="openUploadPicker">上传附件</AppButton>
              </div>

              <DefectAttachmentPanel
                :items="attachmentPanelItems"
                :preview-urls="attachmentPreviewUrls"
                :removing-id="Array.from(deletingAttachmentIds)[0] ?? null"
                empty-title="添加附件或截图"
                empty-description="当前还没有待上传附件，点击上方按钮或在此区域粘贴、拖拽文件。"
                @download="handleAttachmentPanelDownload"
                @remove="handleAttachmentPanelRemove"
              />
              <input ref="uploadInput" class="defect-edit-page__hidden-file" type="file" multiple @change="handleUploadChange">
            </section>
          </section>

          <aside class="defect-edit-page__side">
            <div class="defect-edit-page__field">
              <span class="is-required">工作空间</span>
              <el-select
                v-model="form.workspaceCode"
                class="defect-edit-page__select"
                :disabled="!isCreateMode"
                filterable
                placeholder="请选择工作空间"
              >
                <el-option
                  v-for="workspace in getConcreteWorkspaces()"
                  :key="workspace.workspaceCode"
                  :label="getWorkspaceLabel(workspace)"
                  :value="workspace.workspaceCode"
                />
              </el-select>
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">处理人</span>
              <AppUserSelect
                v-model="form.assigneeId"
                :workspace-code="form.workspaceCode"
                :disabled="saving"
                :fallback-label="detail?.assigneeName"
                placeholder="请选择处理人"
              />
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">优先级</span>
              <div class="defect-edit-page__priority">
                <button
                  v-for="item in defectPriorityOptions"
                  :key="item.value"
                  type="button"
                  :class="{ 'is-active': form.priority === item.value }"
                  @click="form.priority = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <div class="defect-edit-page__field">
              <span class="is-required">严重级别</span>
              <el-select v-model="form.severity" class="defect-edit-page__select">
                <el-option
                  v-for="item in defectSeverityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>

            <div class="defect-edit-page__field">
              <span>关联用例</span>
              <div class="defect-edit-page__case-picker" :class="{ 'is-empty': !form.relatedCaseIds.length }">
                <div class="defect-edit-page__case-picker-main">
                  <strong>{{ selectedCaseLabel }}</strong>
                </div>
                <div class="defect-edit-page__case-picker-actions">
                  <AppButton size="small" :disabled="saving || caseOptionsLoading" @click="openCaseAssociateDialog">
                    选择
                  </AppButton>
                  <AppButton v-if="form.relatedCaseIds.length" size="small" :disabled="saving" @click="clearAssociatedCase">
                    清除
                  </AppButton>
                </div>
              </div>
            </div>

            <div class="defect-edit-page__field">
              <span>标签</span>
              <AppTagInput
                v-model="form.tags"
                placeholder="输入内容后回车可直接添加标签"
              />
            </div>

            <p v-if="optionErrorMessage" class="defect-edit-page__inline-error">{{ optionErrorMessage }}</p>
          </aside>
        </div>

        <p v-if="formError" class="defect-edit-page__inline-error">{{ formError }}</p>
      </main>

      <footer class="defect-edit-page__footer">
        <AppButton :disabled="saving" @click="goBack">取消</AppButton>
        <AppButton v-if="isCreateMode" :disabled="saving || !canSubmit" @click="submit(true)">
          保存并继续创建
        </AppButton>
        <AppButton type="primary" :loading="saving" :disabled="!canSubmit" @click="submit(false)">
          {{ primaryActionText }}
        </AppButton>
      </footer>
    </div>

  </section>

  <DefectCaseAssociateDialog
    v-model="caseAssociateVisible"
    :workspace-code="form.workspaceCode"
    :current-case-id="form.relatedCaseId ? Number(form.relatedCaseId) : null"
    :current-case-ids="form.relatedCaseIds.map(Number).filter(Number.isFinite)"
    @associate="handleCaseAssociated"
  />
</template>

<style scoped>
.defect-edit-page {
  display: flex;
  min-height: 0;
  height: calc(100dvh - 64px - var(--app-space-6) * 2);
  background: var(--app-bg-page);
}

.defect-edit-page__shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) 64px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.defect-edit-page__header {
  display: grid;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-edit-page__backbar {
  display: flex;
  align-items: center;
  padding: var(--app-space-4) var(--app-space-6) 0;
}

.defect-edit-page__back-button {
  padding: 0;
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 600;
}

.defect-edit-page__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-4) var(--app-space-6) var(--app-space-5);
}

.defect-edit-page__titlebar h1 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
  line-height: var(--app-line-height-lg);
}

.defect-edit-page__titlebar p {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-edit-page__content {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  overflow: auto;
  padding: var(--app-space-5) var(--app-space-6);
}

.defect-edit-page__form-surface {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  min-height: 0;
  overflow: visible;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.defect-edit-page__main,
.defect-edit-page__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-5);
}

.defect-edit-page__side {
  border-left: 1px solid var(--app-border-soft);
  background: var(--app-bg-subtle);
}

.defect-edit-page__section-header {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
  padding-bottom: var(--app-space-3);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-edit-page__section-header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
  line-height: var(--app-line-height-sm);
}

.defect-edit-page__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-edit-page__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-edit-page__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
}

.defect-edit-page__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.defect-edit-page__field :deep(.el-input__wrapper),
.defect-edit-page__field :deep(.el-textarea__inner),
.defect-edit-page__field :deep(.el-select__wrapper) {
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}

.defect-edit-page__field :deep(.el-textarea__inner) {
  min-height: 288px;
  padding: 12px 14px;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 1.75;
}

.defect-edit-page__select {
  width: 100%;
}

.defect-edit-page__case-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-3);
  min-height: 66px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-edit-page__case-picker.is-empty {
  border-style: dashed;
  background: var(--app-bg-subtle);
}

.defect-edit-page__case-picker-main {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.defect-edit-page__case-picker-main strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-edit-page__case-picker.is-empty .defect-edit-page__case-picker-main strong {
  color: var(--app-text-muted);
}

.defect-edit-page__case-picker-main span {
  overflow: hidden;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-edit-page__case-picker-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.defect-edit-page__evidence {
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

.defect-edit-page__evidence.is-drop-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.defect-edit-page__evidence-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-edit-page__evidence-head div {
  display: grid;
  gap: 3px;
}

.defect-edit-page__evidence-head strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-edit-page__evidence-head span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-edit-page__hidden-file {
  display: none;
}

.defect-edit-page__priority {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.defect-edit-page__priority button {
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

.defect-edit-page__priority button:hover,
.defect-edit-page__priority button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-edit-page__error,
.defect-edit-page__inline-error {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-edit-page__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-edit-page__inline-error {
  margin: 0;
}

.defect-edit-page__footer {
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-6);
  border-top: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-edit-page__footer :deep(.app-button) {
  min-width: 88px;
  height: 36px;
}

@media (max-width: 1080px) {
  .defect-edit-page__form-surface {
    grid-template-columns: 1fr;
  }

  .defect-edit-page__side {
    border-top: 1px solid var(--app-border-soft);
    border-left: 0;
  }
}

@media (max-width: 720px) {
  .defect-edit-page {
    padding: var(--app-space-3);
  }

  .defect-edit-page__content,
  .defect-edit-page__titlebar,
  .defect-edit-page__footer {
    padding-right: var(--app-space-4);
    padding-left: var(--app-space-4);
  }
}
</style>
