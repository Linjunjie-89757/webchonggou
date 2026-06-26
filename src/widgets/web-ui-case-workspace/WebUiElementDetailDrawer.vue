<script setup lang="ts">
import { Camera, Edit, Link } from '@element-plus/icons-vue'

import {
  formatLocatorType,
  formatWebUiDateTime,
  type WebUiElementItem,
} from '@/entities/web-ui-automation'
import {
  getCollectCandidateSourceMeta,
  getCollectCandidateValidationMeta,
} from '@/entities/web-ui-automation/lib/collectTask'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

defineProps<{
  modelValue: boolean
  target: WebUiElementItem | null
  moduleName: string
  validateTagType: 'success' | 'danger' | 'info' | 'warning'
  validateLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'open-reference': [target: WebUiElementItem]
  'open-collect-task': [target: WebUiElementItem]
  'preview-collect-screenshot': [target: WebUiElementItem]
  edit: [target: WebUiElementItem]
}>()

function isAiCollectedElement(item?: WebUiElementItem | null) {
  return Boolean(item?.collectTaskId || item?.description?.includes('来源：智能采集'))
}

</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="元素详情"
    size="720px"
    class="web-ui-element-detail-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="target" class="web-ui-element-detail">
      <section class="web-ui-element-detail__summary">
        <div>
          <span>元素名称</span>
          <strong>{{ target.elementName }}</strong>
        </div>
        <div>
          <span>状态</span>
          <el-tag :type="target.status === 'ENABLED' ? 'success' : 'info'" effect="light">
            {{ target.status === 'ENABLED' ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div>
          <span>最近验证</span>
          <el-tag :type="validateTagType" effect="light">{{ validateLabel }}</el-tag>
        </div>
        <div>
          <span>引用次数</span>
          <strong>{{ target.usageCount }}</strong>
        </div>
      </section>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="所属空间">{{ target.workspaceName || target.workspaceCode }}</el-descriptions-item>
        <el-descriptions-item label="所属模块">{{ moduleName }}</el-descriptions-item>
        <el-descriptions-item label="页面对象">{{ target.pageName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="页面分组">{{ target.groupName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="定位方式">{{ formatLocatorType(target.locatorType) }}</el-descriptions-item>
        <el-descriptions-item label="定位值">{{ target.locatorValue || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近验证时间">{{ formatWebUiDateTime(target.lastValidateAt) }}</el-descriptions-item>
        <el-descriptions-item label="最近更新时间">{{ formatWebUiDateTime(target.updatedAt) }}</el-descriptions-item>
        <el-descriptions-item label="最近本地验证任务" :span="2">
          {{ target.lastLocalRunnerRunId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          <el-tag :type="isAiCollectedElement(target) ? 'primary' : 'info'" effect="light">
            {{ isAiCollectedElement(target) ? '智能采集' : '手工维护' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源采集任务">
          <template v-if="target.collectTaskId">
            <el-button link type="primary" @click="emit('open-collect-task', target)">
              查看采集任务 #{{ target.collectTaskId }}
            </el-button>
          </template>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="采集来源">
          <el-tooltip :content="getCollectCandidateSourceMeta(target.collectSource).description" placement="top">
            <el-tag :type="getCollectCandidateSourceMeta(target.collectSource).tagType" effect="light">
              {{ getCollectCandidateSourceMeta(target.collectSource).label }}
            </el-tag>
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="采集稳定性">
          {{ target.collectConfidence === null || target.collectConfidence === undefined ? '-' : `${target.collectConfidence}%` }}
        </el-descriptions-item>
        <el-descriptions-item label="采集验证">
          <el-tooltip :content="getCollectCandidateValidationMeta(target.collectValidationStatus).description" placement="top">
            <el-tag :type="getCollectCandidateValidationMeta(target.collectValidationStatus).tagType" effect="light">
              {{ getCollectCandidateValidationMeta(target.collectValidationStatus).label }}
            </el-tag>
          </el-tooltip>
          <span v-if="target.collectMatchCount !== null && target.collectMatchCount !== undefined" class="web-ui-element-detail__inline-note">
            匹配 {{ target.collectMatchCount }} 个
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="采集截图">
          <el-button
            link
            type="primary"
            :disabled="!target.collectScreenshotBase64"
            @click="emit('preview-collect-screenshot', target)"
          >
            查看截图证据
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="采集验证信息" :span="2">
          {{ target.collectValidationMessage || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="验证信息" :span="2">
          {{ target.lastValidateMessage || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ target.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="target.usageCount > 0"
        type="warning"
        show-icon
        :closable="false"
        title="该元素已被用例或模板引用，修改定位器、停用或删除前建议先查看引用影响。"
      />
    </div>

    <template #footer>
      <div class="web-ui-element-detail__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          v-if="target"
          :icon="Link"
          @click="emit('open-reference', target)"
        >
          查看引用
        </AppButton>
        <AppButton
          v-if="target?.collectTaskId"
          :icon="Camera"
          @click="emit('open-collect-task', target)"
        >
          查看来源采集任务
        </AppButton>
        <AppButton
          v-if="target"
          type="primary"
          :icon="Edit"
          @click="emit('edit', target)"
        >
          编辑元素
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-element-detail {
  display: grid;
  gap: var(--app-space-4);
}

.web-ui-element-detail__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-element-detail__summary > div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-element-detail__summary span,
.web-ui-element-detail__inline-note {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-element-detail__summary strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-element-detail__inline-note {
  margin-left: var(--app-space-2);
}

.web-ui-element-detail__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-3);
}
</style>
