<script setup lang="ts">
import { computed } from 'vue'

export type DefectAttachmentPanelItem = {
  id: string | number
  fileName: string
  fileSize?: number | null
  uploadedByName?: string | null
  createdAt?: string | null
  contentType?: string | null
  imageUrl?: string
  pending?: boolean
}

const props = withDefaults(
  defineProps<{
    items: DefectAttachmentPanelItem[]
    previewUrls?: string[]
    downloadingId?: string | number | null
    removingId?: string | number | null
    emptyTitle?: string
    emptyDescription?: string
    showDownload?: boolean
    showRemove?: boolean
    showImageGroupTitle?: boolean
  }>(),
  {
    previewUrls: () => [],
    downloadingId: null,
    removingId: null,
    emptyTitle: '暂无附件',
    emptyDescription: '当前还没有上传截图、日志或其他证据文件。',
    showDownload: true,
    showRemove: true,
    showImageGroupTitle: true,
  },
)

const emit = defineEmits<{
  download: [item: DefectAttachmentPanelItem]
  remove: [item: DefectAttachmentPanelItem]
}>()

const imageItems = computed(() => props.items.filter(isImageItem))
const fileItems = computed(() => props.items.filter(item => !isImageItem(item)))

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function formatFileSize(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '-'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getFileExt(fileName: string) {
  return fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() || 'FILE' : 'FILE'
}

function getItemTypeLabel(item: DefectAttachmentPanelItem) {
  return getFileExt(item.fileName)
}

function getItemTypeTone(item: DefectAttachmentPanelItem) {
  const label = getItemTypeLabel(item)
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG'].includes(label)) {
    return 'image'
  }
  if (label === 'PDF') {
    return 'pdf'
  }
  if (['DOC', 'DOCX'].includes(label)) {
    return 'doc'
  }
  if (['XLS', 'XLSX', 'CSV'].includes(label)) {
    return 'xls'
  }
  if (['ZIP', 'RAR', '7Z'].includes(label)) {
    return 'zip'
  }
  return 'neutral'
}

function isImageItem(item: DefectAttachmentPanelItem) {
  if (item.imageUrl) {
    return true
  }
  if (item.contentType?.startsWith('image/')) {
    return true
  }
  return ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG'].includes(getFileExt(item.fileName))
}

function getPreviewIndex(item: DefectAttachmentPanelItem) {
  if (!item.imageUrl) {
    return 0
  }
  return Math.max(0, props.previewUrls.findIndex(url => url === item.imageUrl))
}

function getImageMeta(item: DefectAttachmentPanelItem) {
  if (item.pending) {
    return '待上传'
  }
  return formatDateTime(item.createdAt) || displayText(item.uploadedByName)
}

function getFileMeta(item: DefectAttachmentPanelItem) {
  const parts = [formatFileSize(item.fileSize)]
  if (item.pending) {
    parts.push('待上传')
  } else {
    parts.push(displayText(item.uploadedByName))
    const time = formatDateTime(item.createdAt)
    if (time) {
      parts.push(time)
    }
  }
  return parts.filter(Boolean).join(' / ')
}
</script>

<template>
  <div v-if="items.length" class="defect-attachment-panel">
    <div v-if="imageItems.length" class="defect-attachment-panel__group">
      <div v-if="showImageGroupTitle" class="defect-attachment-panel__group-title">图片证据</div>
      <div class="defect-attachment-panel__image-grid">
        <div
          v-for="item in imageItems"
          :key="item.id"
          class="defect-attachment-panel__image-card"
        >
          <el-image
            v-if="item.imageUrl"
            :src="item.imageUrl"
            :preview-src-list="previewUrls"
            :initial-index="getPreviewIndex(item)"
            fit="cover"
            preview-teleported
            class="defect-attachment-panel__image-preview"
          />
          <div v-else class="defect-attachment-panel__image-placeholder">
            {{ getItemTypeLabel(item) }}
          </div>
          <div class="defect-attachment-panel__image-caption">
            <strong :title="item.fileName">{{ displayText(item.fileName) }}</strong>
            <small>{{ getImageMeta(item) }}</small>
          </div>
          <div class="defect-attachment-panel__image-actions">
            <el-button
              v-if="showDownload && !item.pending"
              text
              type="primary"
              :loading="downloadingId === item.id"
              :disabled="downloadingId !== null && downloadingId !== item.id"
              @click="emit('download', item)"
            >
              下载
            </el-button>
            <span v-else />
            <el-button
              v-if="showRemove"
              text
              type="danger"
              :loading="removingId === item.id"
              :disabled="removingId !== null && removingId !== item.id"
              @click="emit('remove', item)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="fileItems.length" class="defect-attachment-panel__file-list">
      <div
        v-for="item in fileItems"
        :key="item.id"
        class="defect-attachment-panel__file-row"
      >
        <span
          class="defect-attachment-panel__file-icon"
          :data-tone="getItemTypeTone(item)"
        >
          {{ getItemTypeLabel(item) }}
        </span>
        <span class="defect-attachment-panel__file-main">
          <strong :title="item.fileName">{{ displayText(item.fileName) }}</strong>
          <small>{{ getFileMeta(item) }}</small>
        </span>
        <div class="defect-attachment-panel__file-actions">
          <el-button
            v-if="showDownload && !item.pending"
            text
            type="primary"
            :loading="downloadingId === item.id"
            :disabled="downloadingId !== null && downloadingId !== item.id"
            @click="emit('download', item)"
          >
            下载
          </el-button>
          <el-button
            v-if="showRemove"
            text
            type="danger"
            :loading="removingId === item.id"
            :disabled="removingId !== null && removingId !== item.id"
            @click="emit('remove', item)"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="defect-attachment-panel__empty">
    <strong>{{ emptyTitle }}</strong>
    <span>{{ emptyDescription }}</span>
  </div>
</template>

<style scoped>
.defect-attachment-panel {
  display: grid;
  gap: var(--app-space-4);
}

.defect-attachment-panel__group {
  display: grid;
  gap: var(--app-space-3);
}

.defect-attachment-panel__group-title {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
}

.defect-attachment-panel__image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 170px);
  gap: var(--app-space-3);
}

.defect-attachment-panel__image-card {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: var(--app-space-2);
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-attachment-panel__image-preview,
.defect-attachment-panel__image-placeholder {
  width: 100%;
  height: 132px;
  overflow: hidden;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}

.defect-attachment-panel__image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--app-border-strong);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.defect-attachment-panel__image-caption {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.defect-attachment-panel__image-caption strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.65;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-attachment-panel__image-caption small {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.defect-attachment-panel__image-actions {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  padding-top: 2px;
  border-top: 1px solid var(--app-border-soft);
}

.defect-attachment-panel__image-actions :deep(.el-button) {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.defect-attachment-panel__file-list {
  display: grid;
  gap: var(--app-space-3);
}

.defect-attachment-panel__file-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-attachment-panel__file-icon {
  display: inline-flex;
  width: 42px;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.defect-attachment-panel__file-icon[data-tone='pdf'] {
  border-color: #fecaca;
  background: #fef2f2;
  color: var(--app-danger);
}

.defect-attachment-panel__file-icon[data-tone='doc'] {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-attachment-panel__file-icon[data-tone='xls'] {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.defect-attachment-panel__file-icon[data-tone='image'] {
  border-color: #ddd6fe;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.defect-attachment-panel__file-icon[data-tone='zip'] {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.defect-attachment-panel__file-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-1);
}

.defect-attachment-panel__file-main strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-attachment-panel__file-main small {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-attachment-panel__file-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.defect-attachment-panel__file-actions :deep(.el-button) {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
}

.defect-attachment-panel__empty {
  display: grid;
  place-items: center;
  min-height: 112px;
  padding: var(--app-space-4);
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  text-align: center;
}

.defect-attachment-panel__empty strong {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-attachment-panel__empty span {
  margin-top: var(--app-space-1);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}
</style>
