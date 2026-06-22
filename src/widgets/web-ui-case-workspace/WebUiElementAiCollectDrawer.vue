<script setup lang="ts">
import { Cpu, InfoFilled } from '@element-plus/icons-vue'

import { type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  WEB_UI_LOCATOR_OPTIONS,
  type WebUiElementGroupItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiEnvironmentItem,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'

type AiCollectMode = 'ONLINE' | 'OFFLINE'
type AiCollectScope = 'ALL' | 'FORM' | 'BUTTON' | 'TABLE' | 'DIALOG'
type AiCollectGroupStrategy = 'AI' | 'CUSTOM'
type AiCandidateFilter = 'ALL' | 'RECOMMENDED' | 'FAILED' | 'LOW_CONFIDENCE'

interface AiCollectFormState {
  providerConnectionId: number | null
  environmentId: number | null
  pageUrl: string
  moduleId: number | null
  pageId: number | null
  pageName: string
  groupStrategy: AiCollectGroupStrategy
  groupId: number | null
  groupName: string
  scope: AiCollectScope
  htmlText: string
  screenshotNote: string
}

export interface AiElementCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  confidence: number
  reason: string
  tagName: string | null
  elementType: string | null
  businessMeaning: string | null
  candidateSource: string
  recommendedToSave: boolean
  notRecommendedReason: string | null
  maintenanceSuggestion: string | null
  stabilityNote: string | null
  validationStatus: string
  matchCount: number | null
  validationMessage: string | null
  screenshotBase64: string | null
  saveBlockedReason: string | null
  text?: string | null
  placeholder?: string | null
}

interface AiCandidateSummary {
  total: number
  recommended: number
  passed: number
  abnormal: number
  lowConfidence: number
  aiSupplement: number
  blocked: number
}

defineProps<{
  modelValue: boolean
  aiCollectMode: AiCollectMode
  aiCollectForm: AiCollectFormState
  aiProviderLoading: boolean
  availableAiProviders: AiProviderConnectionItem[]
  enabledEnvironments: WebUiEnvironmentItem[]
  modules: WebUiElementModuleItem[]
  pageOptions: WebUiElementPageItem[]
  groupOptions: WebUiElementGroupItem[]
  candidates: AiElementCandidate[]
  visibleCandidates: AiElementCandidate[]
  candidateSummary: AiCandidateSummary
  selectedCount: number
  candidateFilter: AiCandidateFilter
  collecting: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:aiCollectMode': [value: AiCollectMode]
  'module-change': []
  'page-change': [value: number | null]
  'group-change': [value: number | null]
  'filter-change': [value: AiCandidateFilter]
  generate: []
  'select-recommended': []
  'unselect-risky': []
  'batch-update-group': []
  'preview-screenshot': [candidate: AiElementCandidate]
  save: []
}>()

function formatAiValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 建议未验证'
  if (status === 'PASSED') return '已验证'
  if (status === 'FAILED') return '未找到'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '未验证'
  return status || '未验证'
}

function getAiValidationTagType(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'warning'
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'MULTIPLE') return 'warning'
  return 'info'
}

function formatAiElementType(type?: string | null) {
  if (type === 'FORM') return '表单'
  if (type === 'BUTTON') return '按钮'
  if (type === 'TABLE') return '表格'
  if (type === 'DIALOG') return '弹窗'
  return type || '-'
}

function formatAiCandidateSource(source?: string | null) {
  if (source === 'AI_SUPPLEMENT') return 'AI 补充'
  return '规则候选'
}

function getAiCandidateSourceTagType(source?: string | null) {
  return source === 'AI_SUPPLEMENT' ? 'warning' : 'info'
}

function isAiCandidateSaveable(candidate: AiElementCandidate) {
  return candidate.recommendedToSave
    && candidate.validationStatus === 'PASSED'
    && !candidate.saveBlockedReason
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="860px"
    class="web-ui-ai-collect-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="web-ui-ai-collect__title">
        <span>AI 采集元素</span>
        <el-tooltip
          content="已接入智能采集：先用规则解析页面元素，再使用选择的 AI 连接池模型优化名称、分组和说明。"
          placement="bottom-start"
        >
          <el-icon class="web-ui-ai-collect__title-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>
    </template>

    <el-scrollbar class="web-ui-ai-collect-scrollbar">
      <div class="web-ui-ai-collect">
        <el-radio-group
          :model-value="aiCollectMode"
          class="web-ui-ai-collect__mode"
          @update:model-value="emit('update:aiCollectMode', $event as AiCollectMode)"
        >
          <el-radio-button value="ONLINE">在线采集</el-radio-button>
          <el-radio-button value="OFFLINE">离线导入</el-radio-button>
        </el-radio-group>

        <el-form class="web-ui-ai-collect__form" label-width="104px">
          <el-form-item label="AI 采集模型" required>
            <el-select
              v-model="aiCollectForm.providerConnectionId"
              :loading="aiProviderLoading"
              clearable
              filterable
              placeholder="选择连接池中已配置模型的 AI 连接"
            >
              <el-option
                v-for="item in availableAiProviders"
                :key="item.id"
                :label="`${item.connectionName} / ${item.modelName || '-'}`"
                :value="item.id"
              >
                <div class="web-ui-ai-collect__provider-option">
                  <span>{{ item.connectionName }} / {{ item.modelName || '-' }}</span>
                  <small>{{ item.protocolType }}</small>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <template v-if="aiCollectMode === 'ONLINE'">
            <el-form-item label="运行环境">
              <el-select v-model="aiCollectForm.environmentId" clearable filterable placeholder="选择登录态/环境">
                <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="页面 URL" required>
              <el-input v-model="aiCollectForm.pageUrl" clearable placeholder="https://example.com/orders" />
            </el-form-item>
          </template>

          <template v-else>
            <el-form-item label="HTML / DOM" required>
              <el-input
                v-model="aiCollectForm.htmlText"
                type="textarea"
                :rows="6"
                maxlength="30000"
                show-word-limit
                placeholder="粘贴页面 HTML、DOM 片段，或从浏览器复制出来的关键区域结构"
              />
            </el-form-item>
            <el-form-item label="截图说明">
              <el-input
                v-model="aiCollectForm.screenshotNote"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder="可补充截图里哪些区域要采集，例如：登录表单、查询按钮、结果表格"
              />
            </el-form-item>
          </template>

          <el-form-item label="所属模块" required>
            <el-select
              v-model="aiCollectForm.moduleId"
              clearable
              filterable
              placeholder="选择模块"
              @change="emit('module-change')"
            >
              <el-option v-for="item in modules" :key="item.id" :label="item.moduleName" :value="item.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="页面对象" required>
            <div class="web-ui-ai-collect__page-target">
              <el-select
                v-model="aiCollectForm.pageId"
                clearable
                filterable
                placeholder="选择已有页面对象"
                @change="emit('page-change', $event as number | null)"
              >
                <el-option v-for="item in pageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
              </el-select>
              <el-input v-model="aiCollectForm.pageName" clearable placeholder="或填写新页面对象名称" />
            </div>
          </el-form-item>

          <el-form-item label="分组策略">
            <el-radio-group v-model="aiCollectForm.groupStrategy">
              <el-radio-button value="AI">AI 建议分组</el-radio-button>
              <el-radio-button value="CUSTOM">自选分组</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="aiCollectForm.groupStrategy === 'CUSTOM'" label="自选分组" required>
            <div class="web-ui-ai-collect__group-target">
              <el-select
                v-model="aiCollectForm.groupId"
                clearable
                filterable
                placeholder="选择已有分组"
                :disabled="!aiCollectForm.pageId"
                @change="emit('group-change', $event as number | null)"
              >
                <el-option v-for="item in groupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
              </el-select>
              <el-input v-model="aiCollectForm.groupName" clearable placeholder="或填写新分组名称" />
            </div>
          </el-form-item>

          <el-form-item label="采集范围">
            <el-radio-group v-model="aiCollectForm.scope">
              <el-radio-button value="ALL">全部</el-radio-button>
              <el-radio-button value="FORM">表单</el-radio-button>
              <el-radio-button value="BUTTON">按钮</el-radio-button>
              <el-radio-button value="TABLE">表格</el-radio-button>
              <el-radio-button value="DIALOG">弹窗</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <div v-if="candidates.length" class="web-ui-ai-collect__summary">
          <el-tag type="info" effect="light">候选总数 {{ candidateSummary.total }}</el-tag>
          <el-tag type="success" effect="light">推荐保存 {{ candidateSummary.recommended }}</el-tag>
          <el-tag type="success" effect="light">验证通过 {{ candidateSummary.passed }}</el-tag>
          <el-tag :type="candidateSummary.abnormal ? 'danger' : 'info'" effect="light">
            验证异常 {{ candidateSummary.abnormal }}
          </el-tag>
          <el-tag :type="candidateSummary.lowConfidence ? 'warning' : 'info'" effect="light">
            低稳定性 {{ candidateSummary.lowConfidence }}
          </el-tag>
          <el-tag :type="candidateSummary.aiSupplement ? 'warning' : 'info'" effect="light">
            AI 补充 {{ candidateSummary.aiSupplement }}
          </el-tag>
          <el-tag :type="candidateSummary.blocked ? 'danger' : 'info'" effect="light">
            禁止保存 {{ candidateSummary.blocked }}
          </el-tag>
        </div>

        <div class="web-ui-ai-collect__actions">
          <AppButton type="primary" :icon="Cpu" :loading="collecting" @click="emit('generate')">
            生成候选元素
          </AppButton>
          <div v-if="candidates.length" class="web-ui-ai-collect__batch-actions">
            <AppButton size="small" @click="emit('select-recommended')">选择推荐且通过</AppButton>
            <AppButton size="small" @click="emit('unselect-risky')">取消风险候选</AppButton>
            <AppButton size="small" @click="emit('batch-update-group')">批量改分组</AppButton>
          </div>
          <div class="web-ui-ai-collect__filters">
            <AppButton size="small" :type="candidateFilter === 'ALL' ? 'primary' : 'default'" @click="emit('filter-change', 'ALL')">
              全部
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'RECOMMENDED' ? 'primary' : 'default'" @click="emit('filter-change', 'RECOMMENDED')">
              推荐保存
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'FAILED' ? 'primary' : 'default'" @click="emit('filter-change', 'FAILED')">
              验证异常
            </AppButton>
            <AppButton size="small" :type="candidateFilter === 'LOW_CONFIDENCE' ? 'primary' : 'default'" @click="emit('filter-change', 'LOW_CONFIDENCE')">
              低稳定性
            </AppButton>
            <span>已选 {{ selectedCount }} / {{ candidates.length }}</span>
          </div>
        </div>

        <el-table
          v-if="candidates.length"
          :data="visibleCandidates"
          row-key="id"
          border
          class="web-ui-ai-collect__table"
          empty-text="当前筛选下暂无候选元素"
        >
          <el-table-column label="选择" width="72" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.selected" :disabled="!isAiCandidateSaveable(row)" />
            </template>
          </el-table-column>
          <el-table-column label="来源" width="118">
            <template #default="{ row }">
              <el-tag :type="getAiCandidateSourceTagType(row.candidateSource)" effect="light">
                {{ formatAiCandidateSource(row.candidateSource) }}
              </el-tag>
              <small v-if="row.saveBlockedReason" class="web-ui-ai-collect__hint">{{ row.saveBlockedReason }}</small>
            </template>
          </el-table-column>
          <el-table-column label="推荐" width="110">
            <template #default="{ row }">
              <el-tag :type="row.recommendedToSave ? 'success' : 'info'" effect="light">
                {{ row.recommendedToSave ? '建议保存' : '谨慎保存' }}
              </el-tag>
              <small v-if="row.notRecommendedReason" class="web-ui-ai-collect__hint">{{ row.notRecommendedReason }}</small>
            </template>
          </el-table-column>
          <el-table-column label="建议分组" min-width="130">
            <template #default="{ row }">
              <el-input v-model="row.groupName" maxlength="80" />
            </template>
          </el-table-column>
          <el-table-column label="元素名称" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.elementName" maxlength="80" />
            </template>
          </el-table-column>
          <el-table-column label="定位方式" width="130">
            <template #default="{ row }">
              <el-select v-model="row.locatorType">
                <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="推荐定位器" min-width="220">
            <template #default="{ row }">
              <el-input v-model="row.locatorValue" maxlength="1000" />
            </template>
          </el-table-column>
          <el-table-column label="验证" min-width="150">
            <template #default="{ row }">
              <el-tag :type="getAiValidationTagType(row.validationStatus)" effect="light">
                {{ formatAiValidationStatus(row.validationStatus) }}
              </el-tag>
              <small class="web-ui-ai-collect__hint">
                {{ row.matchCount === null ? row.validationMessage || '-' : `匹配 ${row.matchCount} 个` }}
              </small>
              <el-button
                v-if="row.screenshotBase64"
                link
                type="primary"
                @click="emit('preview-screenshot', row)"
              >
                截图
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="104">
            <template #default="{ row }">
              <span>{{ formatAiElementType(row.elementType) }}</span>
              <small class="web-ui-ai-collect__hint">{{ row.tagName || '-' }}</small>
            </template>
          </el-table-column>
          <el-table-column label="稳定性" width="112">
            <template #default="{ row }">
              <el-progress :percentage="row.confidence" :stroke-width="8" :show-text="false" />
              <small class="web-ui-ai-collect__score">{{ row.confidence }}%</small>
            </template>
          </el-table-column>
          <el-table-column label="业务含义" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.businessMeaning || row.text || row.placeholder || '-' }}</template>
          </el-table-column>
          <el-table-column prop="maintenanceSuggestion" label="维护建议" min-width="180" show-overflow-tooltip />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
        </el-table>

        <AppEmptyState
          v-else
          title="暂无候选元素"
          description="填写采集信息后点击“生成候选元素”，先确认候选结果，再批量保存到元素库。"
        />
      </div>
    </el-scrollbar>

    <template #footer>
      <div class="web-ui-ai-collect__footer">
        <AppButton @click="emit('update:modelValue', false)">关闭</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="!selectedCount"
          @click="emit('save')"
        >
          批量保存
        </AppButton>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.web-ui-ai-collect {
  display: grid;
  gap: var(--app-space-4);
  min-width: 0;
  padding-right: var(--app-space-3);
}

.web-ui-ai-collect__title {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-primary);
  font-weight: 600;
}

.web-ui-ai-collect__title-icon {
  color: var(--app-text-muted);
  cursor: help;
}

.web-ui-ai-collect-drawer :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding-top: 0;
}

.web-ui-ai-collect-scrollbar {
  flex: 1;
  min-height: 0;
}

.web-ui-ai-collect__mode {
  justify-self: flex-start;
}

.web-ui-ai-collect__form {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-ai-collect__page-target,
.web-ui-ai-collect__group-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--app-space-3);
  width: 100%;
}

.web-ui-ai-collect__provider-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-ai-collect__provider-option small {
  color: var(--app-text-muted);
}

.web-ui-ai-collect__actions,
.web-ui-ai-collect__footer,
.web-ui-ai-collect__summary,
.web-ui-ai-collect__batch-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-ai-collect__actions {
  justify-content: space-between;
  flex-wrap: wrap;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ai-collect__summary,
.web-ui-ai-collect__batch-actions {
  flex-wrap: wrap;
}

.web-ui-ai-collect__filters {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
}

.web-ui-ai-collect__footer {
  justify-content: flex-end;
}

.web-ui-ai-collect__table {
  width: 100%;
}

.web-ui-ai-collect__score {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  text-align: center;
}

.web-ui-ai-collect__hint {
  display: block;
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.4;
}

.web-ui-ai-collect :deep(.el-select),
.web-ui-ai-collect :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 700px) {
  .web-ui-ai-collect__page-target,
  .web-ui-ai-collect__group-target {
    grid-template-columns: 1fr;
  }
}
</style>
