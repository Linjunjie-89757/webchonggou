<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeftBold, ArrowRightBold, Close, Delete, DocumentCopy, Edit, Link, MoreFilled, Promotion } from '@element-plus/icons-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  DefectAttachmentPanel,
  type DefectAttachmentPanelItem,
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  type DefectAttachment,
  type DefectComment,
  type DefectDetail,
} from '@/entities/defect'
import DefectCaseAssociateDialog from '@/features/defect-case-associate/DefectCaseAssociateDialog.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type DefectActivityRecord = Record<string, unknown>
type DetailTab = 'basic' | 'detail' | 'case' | 'comment' | 'history'
type DefectCaseRow = {
  id: number
  caseNo?: string | null
  title?: string | null
  workspaceName?: string | null
  caseType?: string | null
}
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defectId?: number | null
    workspaceCode?: string
    currentIndex?: number | null
    totalCount?: number
    refreshKey?: number
  }>(),
  {
    defectId: null,
    workspaceCode: 'ALL',
    currentIndex: null,
    totalCount: 0,
    refreshKey: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: []
  transition: []
  delete: []
  'navigate-prev': []
  'navigate-next': []
}>()

const detail = ref<DefectDetail | null>(null)
const comments = ref<DefectComment[]>([])
const loading = ref(false)
const errorMessage = ref('')
const commentsLoading = ref(false)
const commentsErrorMessage = ref('')
const commentDraft = ref('')
const commentSubmitting = ref(false)
const commentSubmitError = ref('')
const attachmentDownloadingId = ref<number | null>(null)
const attachmentRemovingId = ref<number | null>(null)
const attachmentUploading = ref(false)
const attachmentErrorMessage = ref('')
const attachmentInputRef = ref<HTMLInputElement | null>(null)
const attachmentImageUrls = ref<Record<number, string>>({})
const activeTab = ref<DetailTab>('detail')
const caseKeyword = ref('')
const caseAssociateVisible = ref(false)
const caseAssociating = ref(false)
const caseErrorMessage = ref('')
let detailRequestSeq = 0
let commentsRequestSeq = 0
let attachmentImageRequestSeq = 0

const detailTabs = [
  { key: 'basic', label: '基础信息' },
  { key: 'detail', label: '详情' },
  { key: 'case', label: '用例' },
  { key: 'comment', label: '评论' },
  { key: 'history', label: '历史' },
] as const

const hasRecordNavigation = computed(() => props.totalCount > 1 && props.currentIndex !== null)
const canNavigatePrev = computed(() => hasRecordNavigation.value && (props.currentIndex ?? 0) > 0)
const canNavigateNext = computed(() => hasRecordNavigation.value && (props.currentIndex ?? 0) < props.totalCount - 1)

const activityCount = computed(() => {
  if (!Array.isArray(detail.value?.activities)) {
    return 0
  }

  return detail.value.activities.length
})

const attachmentCount = computed(() => getAttachments(detail.value).length)
const imageAttachments = computed(() => getAttachments(detail.value).filter(isImageAttachment))
const previewImageUrls = computed(() => imageAttachments.value
  .map(attachment => attachmentImageUrls.value[attachment.id])
  .filter(Boolean))
const attachmentPanelItems = computed<DefectAttachmentPanelItem[]>(() => getAttachments(detail.value).map(attachment => ({
  id: attachment.id,
  fileName: attachment.fileName,
  fileSize: attachment.fileSize,
  uploadedByName: attachment.uploadedByName,
  createdAt: attachment.createdAt,
  contentType: attachment.contentType,
  imageUrl: isImageAttachment(attachment) ? getAttachmentImageUrl(attachment) : undefined,
})))
const caseRows = computed(() => {
  const keyword = caseKeyword.value.trim().toLowerCase()
  const rows = getCaseRows(detail.value)
  if (!keyword) {
    return rows
  }

  return rows.filter((caseItem) => {
    const haystack = [
      caseItem.caseNo,
      caseItem.title,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

function closeDrawer() {
  emit('update:modelValue', false)
}

function emitIfDetail(event: 'edit' | 'transition' | 'delete') {
  if (!detail.value) {
    return
  }

  if (event === 'edit') {
    emit('edit')
    return
  }
  if (event === 'transition') {
    emit('transition')
    return
  }
  emit('delete')
}

function getCaseRowKey(caseItem: DefectCaseRow, index: number) {
  return String(caseItem.id ?? caseItem.caseNo ?? `case-${index}`)
}

function openCase(caseItem: DefectCaseRow) {
  if (!caseItem.id) {
    ElMessage.info('当前关联用例缺少详情 ID，暂不能打开。')
    return
  }

  ElMessage.info('用例详情页尚未接入，后续会按用例中心路由统一处理。')
}

function openCaseAssociateDialog() {
  if (!detail.value?.workspaceCode || detail.value.workspaceCode === 'ALL') {
    ElMessage.warning('当前缺陷缺少具体工作空间，暂不能关联用例。')
    return
  }

  caseAssociateVisible.value = true
}

async function associateCase(caseIds: number[]) {
  if (!detail.value) {
    return
  }

  caseAssociating.value = true
  caseErrorMessage.value = ''
  try {
    detail.value = await defectApi.replaceDefectCases(detail.value.workspaceCode, detail.value.id, {
      caseIds,
    })
    caseAssociateVisible.value = false
    ElMessage.success('关联用例已更新')
    void loadDetail()
  } catch (error) {
    caseErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseAssociating.value = false
  }
}

async function unlinkCase(caseItem: DefectCaseRow) {
  if (!detail.value) {
    return
  }

  try {
    await ElMessageBox.confirm('确认取消关联当前用例吗？', '取消关联用例', {
      type: 'warning',
      confirmButtonText: '取消关联',
      cancelButtonText: '保留',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  caseAssociating.value = true
  caseErrorMessage.value = ''
  try {
    detail.value = await defectApi.deleteDefectCase(detail.value.workspaceCode, detail.value.id, caseItem.id)
    ElMessage.success('已取消关联用例')
    void loadDetail()
  } catch (error) {
    caseErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    caseAssociating.value = false
  }
}

function navigatePrev() {
  if (canNavigatePrev.value) {
    emit('navigate-prev')
  }
}

function navigateNext() {
  if (canNavigateNext.value) {
    emit('navigate-next')
  }
}

async function copyShareLink() {
  if (!detail.value || typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.pathname = `/bugs/${detail.value.id}`
  url.search = ''
  if (detail.value.workspaceCode) {
    url.searchParams.set('workspace', detail.value.workspaceCode)
  }

  try {
    await navigator.clipboard.writeText(url.toString())
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.error('链接复制失败')
  }
}

async function copyDefectNo() {
  if (!detail.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(detail.value.bugNo)
    ElMessage.success('缺陷编号已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function displayRichText(value: string | null | undefined) {
  const text = displayText(value)
  if (text === '-' || !/[<>]/.test(text)) {
    return text
  }

  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')

  if (typeof DOMParser === 'undefined') {
    return normalized.replace(/<[^>]+>/g, '').trim() || '-'
  }

  const doc = new DOMParser().parseFromString(normalized, 'text/html')
  return doc.body.textContent?.trim() || '-'
}

function getAttachments(value: DefectDetail | null): DefectAttachment[] {
  return Array.isArray(value?.attachments) ? value.attachments : []
}

function getActivities(value: DefectDetail | null): DefectActivityRecord[] {
  return Array.isArray(value?.activities) ? (value.activities as DefectActivityRecord[]) : []
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function getCaseRows(value: DefectDetail | null): DefectCaseRow[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value.relatedCases) && value.relatedCases.length) {
    return value.relatedCases.map(item => ({
      id: item.id,
      caseNo: item.caseNo,
      title: item.title,
      workspaceName: item.workspaceName,
      caseType: '功能用例',
    }))
  }

  const context = readRecord(value.sourceContext)
  const caseSummary = readRecord(context?.caseSummary)
  if (caseSummary) {
    const caseId = typeof caseSummary.id === 'number' ? caseSummary.id : value.relatedCaseId
    if (!caseId) {
      return []
    }
    return [{
      id: caseId,
      caseNo: typeof caseSummary.caseNo === 'string' ? caseSummary.caseNo : null,
      title: typeof caseSummary.title === 'string' ? caseSummary.title : null,
      workspaceName: typeof caseSummary.workspaceName === 'string' ? caseSummary.workspaceName : value.workspaceName,
      caseType: typeof caseSummary.caseType === 'string' ? caseSummary.caseType : null,
    }]
  }

  if (value.relatedCaseId) {
    return [{
      id: value.relatedCaseId,
      caseNo: `#${value.relatedCaseId}`,
      title: null,
      workspaceName: value.workspaceName,
      caseType: null,
    }]
  }

  return []
}

function isImageAttachment(attachment: DefectAttachment) {
  if (attachment.contentType?.startsWith('image/')) {
    return true
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.fileName || '')
}

function revokeAttachmentImageUrls() {
  Object.values(attachmentImageUrls.value).forEach((url) => {
    window.URL.revokeObjectURL(url)
  })
  attachmentImageUrls.value = {}
}

async function loadAttachmentImageUrls(value: DefectDetail | null) {
  const requestSeq = ++attachmentImageRequestSeq
  revokeAttachmentImageUrls()
  if (!value || !props.defectId) {
    return
  }

  const nextUrls: Record<number, string> = {}
  for (const attachment of getAttachments(value).filter(isImageAttachment)) {
    try {
      const blob = await defectApi.downloadDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
      if (requestSeq !== attachmentImageRequestSeq) {
        return
      }
      nextUrls[attachment.id] = window.URL.createObjectURL(blob)
    } catch {
      // Keep broken thumbnails local to the image card; download still remains available.
    }
  }

  if (requestSeq === attachmentImageRequestSeq) {
    attachmentImageUrls.value = nextUrls
  } else {
    Object.values(nextUrls).forEach(url => window.URL.revokeObjectURL(url))
  }
}

function getAttachmentImageUrl(attachment: DefectAttachment) {
  return attachmentImageUrls.value[attachment.id] || ''
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function readActivityString(activity: DefectActivityRecord, keys: string[]) {
  for (const key of keys) {
    const value = activity[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }

  return ''
}

function getActivityKey(activity: DefectActivityRecord, index: number) {
  return readActivityString(activity, ['id', 'activityId', 'createdAt', 'occurredAt']) || `activity-${index}`
}

function getActivityTitle(activity: DefectActivityRecord) {
  const title = readActivityString(activity, ['title', 'type', 'action']) || '缺陷记录'
  const actor = getActivityActor(activity)
  if (!actor || title.includes(actor)) {
    return title
  }

  return `${actor} ${title}`
}

function getActivityDetail(activity: DefectActivityRecord) {
  const detailText = readActivityString(activity, ['detail', 'content', 'comment', 'description', 'message'])
  const attachmentName = readActivityString(activity, ['attachmentName', 'fileName'])
  const fromStatus = readActivityString(activity, ['fromStatus', 'from'])
  const toStatus = readActivityString(activity, ['toStatus', 'to'])
  const statusText = fromStatus && toStatus ? `${fromStatus} -> ${toStatus}` : ''

  return [detailText, attachmentName, statusText].filter(Boolean).join(' / ') || '-'
}

function getActivityTime(activity: DefectActivityRecord) {
  return formatDefectDateTime(readActivityString(activity, ['occurredAt', 'createdAt', 'updatedAt']))
}

function getActivityActor(activity: DefectActivityRecord) {
  return readActivityString(activity, ['operatorName', 'actorName', 'createdByName', 'userName']) || '系统记录'
}

function getAvatarText(value: string | null | undefined) {
  const text = displayText(value)
  return text === '-' ? '?' : text.trim().slice(0, 1).toUpperCase()
}

async function loadDetail() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    const nextDetail = await defectApi.getDefectDetail(props.workspaceCode, props.defectId)
    if (requestSeq === detailRequestSeq) {
      detail.value = nextDetail
      comments.value = Array.isArray(nextDetail.comments) ? nextDetail.comments : comments.value
      void loadAttachmentImageUrls(nextDetail)
    }
  } catch (error) {
    if (requestSeq === detailRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === detailRequestSeq) {
      loading.value = false
    }
  }
}

async function loadComments() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++commentsRequestSeq
  commentsLoading.value = true
  commentsErrorMessage.value = ''
  try {
    const nextComments = await defectApi.getDefectComments(props.workspaceCode, props.defectId)
    if (requestSeq === commentsRequestSeq) {
      comments.value = nextComments
    }
  } catch (error) {
    if (requestSeq === commentsRequestSeq) {
      commentsErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === commentsRequestSeq) {
      commentsLoading.value = false
    }
  }
}

async function submitComment() {
  if (!props.defectId || commentSubmitting.value) {
    return
  }

  const content = commentDraft.value.trim()
  if (!content) {
    commentSubmitError.value = '请输入评论内容。'
    return
  }

  commentSubmitting.value = true
  commentSubmitError.value = ''
  try {
    const nextComment = await defectApi.addDefectComment(props.workspaceCode, props.defectId, { content })
    comments.value = [...comments.value, nextComment]
    commentDraft.value = ''
    void loadDetail()
  } catch (error) {
    commentSubmitError.value = getRequestErrorMessage(error)
  } finally {
    commentSubmitting.value = false
  }
}

async function downloadAttachment(attachment: DefectAttachment) {
  if (!props.defectId || attachmentDownloadingId.value) {
    return
  }

  attachmentDownloadingId.value = attachment.id
  attachmentErrorMessage.value = ''
  try {
    const blob = await defectApi.downloadDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
    triggerBlobDownload(blob, attachment.fileName)
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentDownloadingId.value = null
  }
}

function openAttachmentPicker() {
  attachmentInputRef.value?.click()
}

async function uploadAttachments(event: Event) {
  if (!props.defectId || attachmentUploading.value) {
    return
  }

  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) {
    return
  }

  attachmentUploading.value = true
  attachmentErrorMessage.value = ''
  try {
    const nextAttachments = await defectApi.uploadDefectAttachments(props.workspaceCode, props.defectId, files)
    if (detail.value) {
      detail.value = {
        ...detail.value,
        attachments: [...getAttachments(detail.value), ...nextAttachments],
      }
    }
    ElMessage.success('附件已上传。')
    void loadDetail()
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentUploading.value = false
  }
}

async function removeAttachment(attachment: DefectAttachment) {
  if (!props.defectId || attachmentRemovingId.value || !detail.value) {
    return
  }

  await ElMessageBox.confirm(`确认删除附件“${attachment.fileName}”吗？`, '删除附件', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger',
  })

  attachmentRemovingId.value = attachment.id
  attachmentErrorMessage.value = ''
  try {
    await defectApi.deleteDefectAttachment(props.workspaceCode, props.defectId, attachment.id)
    detail.value = {
      ...detail.value,
      attachments: getAttachments(detail.value).filter(item => item.id !== attachment.id),
    }
    ElMessage.success('附件已删除。')
    void loadDetail()
  } catch (error) {
    attachmentErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    attachmentRemovingId.value = null
  }
}

function handleAttachmentPanelDownload(item: DefectAttachmentPanelItem) {
  const attachment = getAttachments(detail.value).find(entry => entry.id === item.id)
  if (attachment) {
    void downloadAttachment(attachment)
  }
}

function handleAttachmentPanelRemove(item: DefectAttachmentPanelItem) {
  const attachment = getAttachments(detail.value).find(entry => entry.id === item.id)
  if (attachment) {
    void removeAttachment(attachment)
  }
}

watch(
  () => [props.modelValue, props.defectId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      activeTab.value = 'detail'
      commentDraft.value = ''
      commentSubmitError.value = ''
      attachmentErrorMessage.value = ''
      attachmentUploading.value = false
      attachmentRemovingId.value = null
      void loadDetail()
      void loadComments()
    } else {
      attachmentImageRequestSeq += 1
      revokeAttachmentImageUrls()
    }
  },
  { immediate: true },
)

watch(
  () => props.refreshKey,
  () => {
    if (!props.modelValue || !props.defectId) {
      return
    }

    void loadDetail()
    void loadComments()
  },
)

onBeforeUnmount(() => {
  attachmentImageRequestSeq += 1
  revokeAttachmentImageUrls()
})
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :with-header="false"
    size="850px"
    drawer-class="defect-detail-drawer-host"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-detail-drawer">
      <header class="defect-detail-drawer__topbar">
        <div class="defect-detail-drawer__title-wrap">
          <div class="defect-detail-drawer__object-line">
            <DefectPriorityBadge v-if="detail" :priority="detail.priority" />
            <span class="defect-detail-drawer__code">{{ displayText(detail?.bugNo) }}</span>
            <strong class="defect-detail-drawer__title">{{ displayText(detail?.title || '缺陷详情') }}</strong>
            <DefectStatusBadge v-if="detail" :status="detail.status" />
          </div>
        </div>

        <div class="defect-detail-drawer__actions">
          <div v-if="hasRecordNavigation" class="defect-detail-drawer__record-nav">
            <AppButton
              class="defect-detail-drawer__nav-button"
              size="small"
              :icon="ArrowLeftBold"
              :disabled="!canNavigatePrev"
              @click="navigatePrev"
            />
            <AppButton
              class="defect-detail-drawer__nav-button"
              size="small"
              :icon="ArrowRightBold"
              :disabled="!canNavigateNext"
              @click="navigateNext"
            />
          </div>

          <AppButton v-if="detail" size="small" :icon="Promotion" @click="emitIfDetail('transition')">流转</AppButton>
          <AppButton v-if="detail" size="small" :icon="Link" @click="copyShareLink">分享</AppButton>

          <el-dropdown v-if="detail" trigger="click" popper-class="defect-detail-drawer__more-menu">
            <AppButton class="defect-detail-drawer__more-button" size="small" :icon="MoreFilled" aria-label="更多操作" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="Edit" @click="emitIfDetail('edit')">编辑</el-dropdown-item>
                <el-dropdown-item :icon="DocumentCopy" @click="copyDefectNo">复制</el-dropdown-item>
                <el-dropdown-item class="is-danger" :icon="Delete" @click="emitIfDetail('delete')">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <AppButton
            class="defect-detail-drawer__close-button"
            size="small"
            :icon="Close"
            aria-label="关闭"
            @click="closeDrawer"
          />
        </div>
      </header>

      <nav v-if="detail" class="defect-detail-drawer__tabs" aria-label="缺陷详情分区">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          type="button"
          class="defect-detail-drawer__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="defect-detail-drawer__content">
        <AppLoadingState v-if="loading && !detail" text="正在加载缺陷详情..." />

        <AppEmptyState v-else-if="errorMessage && !detail" title="缺陷详情加载失败" :description="errorMessage">
          <template #actions>
            <AppButton @click="loadDetail">重试</AppButton>
          </template>
        </AppEmptyState>

        <template v-else-if="detail">
          <div v-if="errorMessage" class="defect-detail-drawer__inline-error">
            {{ errorMessage }}
            <AppButton size="small" @click="loadDetail">重试</AppButton>
          </div>

          <section v-show="activeTab === 'basic'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section defect-detail-drawer__section--hero">
              <div class="defect-detail-drawer__section-header">
                <h4>基础信息</h4>
                <span>缺陷流转中的核心字段</span>
              </div>
              <dl class="defect-detail-drawer__meta">
                <div class="defect-detail-drawer__meta-row">
                  <dt>所属空间</dt>
                  <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>处理人</dt>
                  <dd>{{ displayText(detail.assigneeName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>报告人</dt>
                  <dd>{{ displayText(detail.reporterName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>关联用例</dt>
                  <dd>{{ detail.relatedCaseCount ? `${detail.relatedCaseCount} 条` : '-' }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>创建时间</dt>
                  <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>更新时间</dt>
                  <dd>{{ formatDefectDateTime(detail.updatedAt) }}</dd>
                </div>
              </dl>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>状态</h4>
                <span>当前处理状态、优先级和严重级别</span>
              </div>
              <div class="defect-detail-drawer__badges">
                <DefectStatusBadge :status="detail.status" />
                <DefectPriorityBadge :priority="detail.priority" />
                <DefectSeverityBadge :severity="detail.severity" />
              </div>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>标签</h4>
                <span>用于快速归类和筛选</span>
              </div>
              <div class="defect-detail-drawer__content-card defect-detail-drawer__content-card--soft">
                <p class="defect-detail-drawer__text is-compact">{{ formatDefectTags(detail.tags) }}</p>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'detail'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>缺陷标题</h4>
                <span>当前缺陷的标题信息</span>
              </div>
              <div class="defect-detail-drawer__content-card defect-detail-drawer__content-card--soft">
                <p class="defect-detail-drawer__text is-compact">{{ displayText(detail.title) }}</p>
              </div>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>缺陷描述</h4>
                <span>复现现象、影响范围和补充信息</span>
              </div>
              <div class="defect-detail-drawer__content-card defect-detail-drawer__content-card--soft">
                <p class="defect-detail-drawer__text">{{ displayRichText(detail.description) }}</p>
              </div>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>附件</h4>
                <span>{{ attachmentCount }} 个附件</span>
              </div>
              <div class="defect-detail-drawer__attachment-toolbar">
                <input
                  ref="attachmentInputRef"
                  class="defect-detail-drawer__file-input"
                  type="file"
                  multiple
                  @change="uploadAttachments"
                />
                <AppButton size="small" type="primary" :loading="attachmentUploading" @click="openAttachmentPicker">
                  上传附件
                </AppButton>
              </div>
              <DefectAttachmentPanel
                :items="attachmentPanelItems"
                :preview-urls="previewImageUrls"
                :downloading-id="attachmentDownloadingId"
                :removing-id="attachmentRemovingId"
                @download="handleAttachmentPanelDownload"
                @remove="handleAttachmentPanelRemove"
              />
              <p v-if="attachmentErrorMessage" class="defect-detail-drawer__form-error">
                {{ attachmentErrorMessage }}
              </p>
            </div>
          </section>

          <section v-show="activeTab === 'case'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__case-toolbar">
                <AppButton size="small" type="primary" plain :loading="caseAssociating" @click="openCaseAssociateDialog">
                  关联用例
                </AppButton>
                <el-input
                  v-model="caseKeyword"
                  clearable
                  class="defect-detail-drawer__case-search"
                  placeholder="按用例编号或名称搜索"
                />
              </div>

              <el-table
                v-if="caseRows.length"
                :data="caseRows"
                :row-key="(row: DefectCaseRow, index: number) => getCaseRowKey(row, index)"
                class="defect-detail-drawer__case-table"
              >
                <el-table-column prop="caseNo" label="用例编号" min-width="150">
                  <template #default="{ row }">
                    <el-button text type="primary" class="defect-detail-drawer__case-link" @click="openCase(row)">
                      {{ displayText(row.caseNo || row.id) }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="title" label="用例名称" min-width="260" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="defect-detail-drawer__case-title">{{ displayText(row.title) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="workspaceName" label="所属项目" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ displayText(row.workspaceName) }}
                  </template>
                </el-table-column>
                <el-table-column prop="caseType" label="用例类型" width="120">
                  <template #default="{ row }">
                    {{ displayText(row.caseType || '功能用例') }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" fixed="right">
                  <template #default="{ row }">
                    <el-button text type="danger" class="defect-detail-drawer__case-action" :loading="caseAssociating" @click="unlinkCase(row)">
                      取消关联
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>

              <el-empty v-else description="暂无关联用例" :image-size="72" />
              <p v-if="caseErrorMessage" class="defect-detail-drawer__form-error">
                {{ caseErrorMessage }}
              </p>
            </div>
          </section>

          <section v-show="activeTab === 'comment'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>评论</h4>
                <span>{{ comments.length }} 条评论</span>
              </div>
              <AppLoadingState v-if="commentsLoading && !comments.length" text="正在加载评论..." />

              <div v-else-if="commentsErrorMessage && !comments.length" class="defect-detail-drawer__inline-error">
                <span>{{ commentsErrorMessage }}</span>
                <AppButton size="small" @click="loadComments">重试</AppButton>
              </div>

              <div v-else-if="comments.length" class="defect-detail-drawer__comment-list">
                <div v-for="comment in comments" :key="comment.id" class="defect-detail-drawer__comment-item">
                  <div class="defect-detail-drawer__comment-avatar">
                    {{ getAvatarText(comment.commenterName) }}
                  </div>
                  <div class="defect-detail-drawer__comment-bubble">
                    <div class="defect-detail-drawer__comment-top">
                      <strong>{{ displayText(comment.commenterName) }}</strong>
                      <span>{{ formatDefectDateTime(comment.createdAt) }}</span>
                    </div>
                    <p>{{ displayText(comment.content) }}</p>
                  </div>
                </div>
              </div>

              <AppEmptyState
                v-else
                title="暂无评论"
                description="还没有人在这条缺陷下留言，可以补充处理说明、现象说明或验证结果。"
              />
            </div>
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>发表评论</h4>
                <span>当前仅支持纯文本评论</span>
              </div>
              <div class="defect-detail-drawer__comment-editor">
                <el-input
                  v-model="commentDraft"
                  type="textarea"
                  :rows="4"
                  maxlength="500"
                  show-word-limit
                  placeholder="输入评论内容"
                  :disabled="commentSubmitting"
                />
                <p v-if="commentSubmitError" class="defect-detail-drawer__form-error">
                  {{ commentSubmitError }}
                </p>
                <div class="defect-detail-drawer__comment-actions">
                  <AppButton
                    type="primary"
                    :loading="commentSubmitting"
                    :disabled="!commentDraft.trim() || commentSubmitting"
                    @click="submitComment"
                  >
                    提交评论
                  </AppButton>
                </div>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'history'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>历史</h4>
                <span>{{ activityCount }} 条记录</span>
              </div>
              <div v-if="getActivities(detail).length" class="defect-detail-drawer__timeline">
                <div
                  v-for="(activity, index) in getActivities(detail)"
                  :key="getActivityKey(activity, index)"
                  class="defect-detail-drawer__timeline-item"
                >
                  <span class="defect-detail-drawer__timeline-dot" />
                  <span class="defect-detail-drawer__timeline-main">
                    <strong>{{ getActivityTitle(activity) }}</strong>
                    <small>
                      <span>{{ getActivityActor(activity) }}</span>
                      <span>{{ getActivityDetail(activity) }}</span>
                    </small>
                  </span>
                  <time>{{ getActivityTime(activity) }}</time>
                </div>
              </div>
              <AppEmptyState
                v-else
                title="暂无历史"
                description="当前缺陷还没有更多流转或操作记录。"
              />
            </div>
          </section>
        </template>
      </div>
    </div>
    <DefectCaseAssociateDialog
      v-model="caseAssociateVisible"
      :workspace-code="detail?.workspaceCode || props.workspaceCode"
      :current-case-id="detail?.relatedCaseId ?? null"
      :current-case-ids="getCaseRows(detail).map(item => item.id).filter((id): id is number => typeof id === 'number')"
      :associating="caseAssociating"
      @associate="associateCase"
    />
  </AppDrawer>
</template>

<style scoped>
.defect-detail-drawer {
  display: flex;
  height: 100%;
  flex-direction: column;
  min-height: 0;
  background: var(--app-bg-panel);
}

:global(.defect-detail-drawer-host .el-drawer__body) {
  min-height: 0;
  padding: 0;
}

:global(.defect-detail-drawer-host .el-overlay) {
  backdrop-filter: blur(10px);
}

:global(.defect-detail-drawer-host .el-drawer) {
  box-shadow: -24px 0 48px rgba(15, 23, 42, 0.18);
}

.defect-detail-drawer__topbar {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 72px;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__title-wrap {
  min-width: 0;
  flex: 1;
}

.defect-detail-drawer__object-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  white-space: nowrap;
}

.defect-detail-drawer__code {
  flex: 0 0 auto;
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
}

.defect-detail-drawer__title {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
  line-height: var(--app-line-height-lg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-drawer__subtitle {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-1);
  min-width: 0;
}

.defect-detail-drawer__record-nav {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  margin-right: var(--app-space-2);
  padding-right: var(--app-space-3);
  border-right: 1px solid var(--app-border);
}

.defect-detail-drawer__actions :deep(.el-button) {
  min-height: 30px;
  padding: 0 10px;
  border-color: transparent;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-main);
  font-size: 13px;
  font-weight: 400;
  box-shadow: none;
}

.defect-detail-drawer__actions :deep(.el-button:hover),
.defect-detail-drawer__actions :deep(.el-button:focus-visible) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  outline: none;
}

:deep(.defect-detail-drawer__nav-button.el-button),
:deep(.defect-detail-drawer__more-button.el-button),
:deep(.defect-detail-drawer__close-button.el-button) {
  width: 30px;
  min-width: 30px;
  padding: 0;
}

:global(.defect-detail-drawer__more-menu .el-dropdown-menu__item.is-danger) {
  color: var(--app-danger);
}

:global(.defect-detail-drawer__more-menu .el-dropdown-menu__item.is-danger:hover) {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.defect-detail-drawer__tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-5);
  min-height: 44px;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__tab {
  position: relative;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 44px;
  white-space: nowrap;
  transition: color 160ms ease;
}

.defect-detail-drawer__tab:hover,
.defect-detail-drawer__tab:focus-visible {
  color: var(--app-primary);
  outline: none;
}

.defect-detail-drawer__tab.is-active {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-detail-drawer__tab.is-active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px 999px 0 0;
  background: var(--app-primary);
  content: '';
}

.defect-detail-drawer__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: var(--app-space-5) var(--app-space-6);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__pane {
  display: grid;
  gap: var(--app-space-5);
}

.defect-detail-drawer__content-card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__content-card--soft {
  background: var(--app-bg-subtle);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.defect-detail-drawer__badges {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.defect-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: 0;
  border: 0;
  background: transparent;
}

.defect-detail-drawer__section--hero {
  gap: var(--app-space-4);
}

.defect-detail-drawer__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-1);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__section-header h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.defect-detail-drawer__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__meta {
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__meta-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  min-height: 42px;
  min-width: 0;
  align-items: center;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__meta-row:last-child {
  border-bottom: 0;
}

.defect-detail-drawer__meta dt {
  height: 100%;
  margin: 0;
  padding: 11px var(--app-space-4);
  background: var(--app-bg-subtle);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__meta dd {
  margin: 0;
  padding: 11px var(--app-space-4);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text {
  margin: 0;
  padding: var(--app-space-4);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 24px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text.is-compact {
  padding-top: var(--app-space-3);
  padding-bottom: var(--app-space-3);
}

.defect-detail-drawer__attachment-list,
.defect-detail-drawer__comment-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  min-width: 0;
  gap: var(--app-space-3);
  align-items: flex-start;
}

.defect-detail-drawer__comment-item strong {
  min-width: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 1;
}

.defect-detail-drawer__comment-bubble {
  min-width: 0;
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.defect-detail-drawer__comment-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-top span {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__comment-bubble p {
  margin: 0;
  padding-top: var(--app-space-2);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-editor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-actions {
  display: flex;
  justify-content: flex-end;
}

.defect-detail-drawer__form-error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-detail-drawer__list-item span,
.defect-detail-drawer__muted {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__attachment-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__attachment-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: -2px;
}

.defect-detail-drawer__file-input {
  display: none;
}

.defect-detail-drawer__case-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-drawer__case-toolbar :deep(.el-button) {
  height: 32px;
  border-radius: var(--app-radius-sm);
  font-size: 13px;
}

.defect-detail-drawer__case-search {
  width: min(280px, 100%);
}

.defect-detail-drawer__case-search :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-sm);
}

.defect-detail-drawer__case-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__case-table :deep(.el-table__header th.el-table__cell) {
  height: 40px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-detail-drawer__case-table :deep(.el-table__row) {
  height: 48px;
}

.defect-detail-drawer__case-table :deep(.el-table__cell) {
  padding: 8px 0;
}

.defect-detail-drawer__case-table :deep(.cell) {
  font-size: 13px;
  line-height: 20px;
}

.defect-detail-drawer__case-table :deep(.el-table__fixed-right::before) {
  box-shadow: -1px 0 0 var(--app-border-soft);
}

.defect-detail-drawer__case-link {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 600;
}

.defect-detail-drawer__case-title {
  color: var(--app-text-primary);
}

.defect-detail-drawer__case-action {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.defect-detail-drawer__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-detail-drawer__timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.defect-detail-drawer__timeline-item:not(:last-child)::before {
  position: absolute;
  top: 100%;
  left: 9px;
  width: 1px;
  height: var(--app-space-2);
  background: var(--app-border);
  content: '';
}

.defect-detail-drawer__timeline-dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border: 2px solid var(--app-primary);
  border-radius: 999px;
  background: var(--app-bg-panel);
}

.defect-detail-drawer__timeline-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
}

.defect-detail-drawer__timeline-main strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__timeline-main small,
.defect-detail-drawer__timeline-item time {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__timeline-main small {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.defect-detail-drawer__timeline-item time {
  white-space: nowrap;
}

.defect-detail-drawer__muted {
  margin: 0;
  padding: var(--app-space-4) 0;
  text-align: center;
}

.defect-detail-drawer__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .defect-detail-drawer__topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .defect-detail-drawer__close {
    position: absolute;
    top: var(--app-space-3);
    right: var(--app-space-3);
  }

  .defect-detail-drawer__tabs {
    gap: var(--app-space-4);
    overflow-x: auto;
  }

  .defect-detail-drawer__case-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .defect-detail-drawer__case-search {
    width: 100%;
  }

  .defect-detail-drawer__badges {
    justify-content: flex-start;
  }

  .defect-detail-drawer__meta {
    grid-template-columns: 1fr;
  }

  .defect-detail-drawer__meta-row,
  .defect-detail-drawer__timeline-item {
    grid-template-columns: 1fr;
  }
}
</style>

