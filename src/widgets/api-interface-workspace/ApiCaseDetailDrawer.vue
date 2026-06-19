<script setup lang="ts">
import { X } from '@lucide/vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  subtitle: string
  method: string
  path: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'requestClose'): void
}>()

function handleDrawerModelValueChange(value: boolean) {
  if (!value) {
    emit('requestClose')
    return
  }
  emit('update:modelValue', value)
}

function handleBeforeClose() {
  emit('requestClose')
}

function handleCloseClick() {
  emit('requestClose')
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    append-to-body
    destroy-on-close
    :with-header="false"
    :show-close="false"
    close-on-click-modal
    close-on-press-escape
    modal-class="api-case-drawer-modal"
    size="894px"
    class="api-case-detail-drawer"
    :before-close="handleBeforeClose"
    @update:model-value="handleDrawerModelValueChange"
  >
    <div class="api-case-drawer-shell">
      <div class="api-case-drawer-top">
        <div class="api-case-drawer-header">
          <div class="api-case-drawer-title">{{ props.title }}</div>
          <div class="api-case-drawer-subtitle">{{ props.subtitle }}</div>
        </div>
        <button type="button" class="api-case-drawer-close" @click="handleCloseClick">
          <X />
        </button>
      </div>

      <div class="api-case-drawer-scroll">
        <div class="api-case-drawer-summary-card">
          <div class="api-case-drawer-summary-meta">
            <span :class="['case-drawer-method-tag', `request-method-${props.method.toLowerCase()}`]">{{ props.method }}</span>
            <span class="api-case-drawer-summary-path">{{ props.path || '未设置路径' }}</span>
          </div>
        </div>

        <slot />
      </div>
    </div>
  </el-drawer>
</template>

<style>
.api-case-drawer-modal {
  background: rgba(15, 23, 42, 0.28);
}

.el-drawer.api-case-detail-drawer {
  max-width: calc(100vw - 24px);
  overflow: hidden;
  border-left: 1px solid #e5e7eb;
  border-radius: 16px 0 0 16px;
  background: #fff;
  box-shadow: -24px 0 56px rgba(15, 23, 42, 0.16);
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

.api-case-detail-drawer .el-drawer__body {
  padding: 0;
  overflow: hidden;
  background: #fff;
}

.api-case-detail-drawer .el-button,
.api-case-detail-drawer .el-input__inner {
  font-family: inherit;
}

.api-case-detail-drawer .api-case-drawer-shell {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.api-case-detail-drawer .api-case-drawer-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-detail-drawer .api-case-drawer-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-detail-drawer .api-case-drawer-title {
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-detail-drawer .api-case-drawer-subtitle {
  overflow: hidden;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-detail-drawer .api-case-drawer-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.api-case-detail-drawer .api-case-drawer-close:hover,
.api-case-detail-drawer .api-case-drawer-close:focus-visible {
  background: #f3f4f6;
  color: #374151;
}

.api-case-detail-drawer .api-case-drawer-close svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.api-case-detail-drawer .api-case-drawer-scroll {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 20px 24px 24px;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.api-case-detail-drawer .api-case-drawer-scroll::-webkit-scrollbar {
  width: 8px;
}

.api-case-detail-drawer .api-case-drawer-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.72);
}

.api-case-detail-drawer .api-case-drawer-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.api-case-detail-drawer .api-case-drawer-summary-card {
  padding: 0;
}

.api-case-detail-drawer .api-case-drawer-summary-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-case-detail-drawer .case-drawer-method-tag {
  display: inline-flex;
  min-width: 52px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-get,
.api-case-detail-drawer .case-drawer-method-tag.request-method-head {
  color: #15803d;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-post {
  color: #ea580c;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-put {
  color: #2563eb;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-delete {
  color: #dc2626;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-patch,
.api-case-detail-drawer .case-drawer-method-tag.request-method-options {
  color: #7c3aed;
}

.api-case-detail-drawer .case-drawer-method-tag.request-method-trace {
  color: #6b7280;
}

.api-case-detail-drawer .api-case-drawer-summary-path {
  min-width: 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}

.api-case-detail-drawer .api-case-drawer-tabs,
.api-case-detail-drawer .api-case-drawer-body,
.api-case-detail-drawer .api-case-drawer-response {
  min-width: 0;
}

.api-case-detail-drawer .ms-like-top-tabs,
.api-case-detail-drawer .ms-like-response-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 40px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  scrollbar-width: none;
}

.api-case-detail-drawer .ms-like-top-tabs::-webkit-scrollbar,
.api-case-detail-drawer .ms-like-response-tabs::-webkit-scrollbar {
  display: none;
}

.api-case-detail-drawer .ms-like-top-tab {
  position: relative;
  display: inline-flex;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

.api-case-detail-drawer .ms-like-top-tab:hover {
  color: #111827;
}

.api-case-detail-drawer .ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.api-case-detail-drawer .ms-like-tab-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.api-case-detail-drawer .ms-like-response-shell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.api-case-detail-drawer .ms-like-response-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-case-detail-drawer .ms-like-response-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.api-case-detail-drawer .ms-like-response-metrics {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.api-case-detail-drawer .ms-like-response-metric,
.api-case-detail-drawer .ms-like-result-pill {
  display: inline-flex;
  min-width: 48px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.api-case-detail-drawer .ms-like-result-pill.is-success,
.api-case-detail-drawer .ms-like-result-pill.is-passed,
.api-case-detail-drawer .ms-like-response-metric.is-success {
  background: #f0fdf4;
  color: #16a34a;
}

.api-case-detail-drawer .ms-like-result-pill.is-failed,
.api-case-detail-drawer .ms-like-response-metric.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.api-case-detail-drawer .ms-like-response-metric.is-warning {
  background: #fff7ed;
  color: #ea580c;
}

.api-case-detail-drawer .ms-like-response-body {
  min-width: 0;
  padding: 10px 0 12px;
}

.api-case-detail-drawer .ms-like-response-empty {
  padding: 18px 0 20px;
}

.api-case-detail-drawer .ms-like-response-empty-card {
  display: grid;
  min-height: 116px;
  place-items: center;
  gap: 10px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.api-case-detail-drawer .ms-like-response-empty-window {
  display: flex;
  width: 58px;
  height: 36px;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.api-case-detail-drawer .ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
}

.api-case-detail-drawer .ms-like-response-empty-text {
  color: #6b7280;
  font-size: 13px;
}

.api-case-detail-drawer .ms-like-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}
</style>
