<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import {
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectDetail,
  type DefectSummaryItem,
} from '@/entities/defect'
import { userApi, type UserItem } from '@/entities/user'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildSaveDefectPayload,
  createDefaultDefectForm,
  createDefectFormFromDetail,
  createDefectFormFromSummary,
  type DefectDialogMode,
  type DefectForm,
  validateDefectForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DefectDialogMode
    defectItem?: DefectSummaryItem | null
    defectDetail?: DefectDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
  }>(),
  {
    defectItem: null,
    defectDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveDefectPayload>]
  retryDetail: []
}>()

const form = reactive<DefectForm>(createDefaultDefectForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const users = ref<UserItem[]>([])
const userOptionsLoading = ref(false)
const userOptionsError = ref('')
const workspaceOptions = ref<WorkspaceItem[]>([])
const workspaceOptionsLoading = ref(false)
const workspaceOptionsError = ref('')
const caseOptions = ref<CaseSummaryItem[]>([])
const caseOptionsLoading = ref(false)
const caseOptionsError = ref('')
let userOptionsLoaded = false
let workspaceOptionsLoaded = false
let caseOptionsRequestSeq = 0
let loadedCaseOptionsWorkspaceCode = ''
let loadingCaseOptionsWorkspaceCode = ''

const activeWorkspaceCode = computed(() => form.workspaceCode || props.defaultWorkspaceCode || 'ALL')
const dialogTitle = computed(() => (props.mode === 'create' ? '新增缺陷' : '编辑缺陷'))
const introTitle = computed(() => (props.mode === 'create' ? '填写缺陷基础信息' : '调整缺陷基础信息'))

function getUserLabel(user: UserItem) {
  return user.displayName || user.username || `用户 ${user.id}`
}

function getCaseLabel(item: CaseSummaryItem) {
  const caseNo = item.caseNo || `#${item.id}`
  return item.title ? `${caseNo} · ${item.title}` : caseNo
}

function getConcreteWorkspaces() {
  return workspaceOptions.value.filter((item) => item.workspaceCode && item.workspaceCode !== 'ALL' && !item.allScope)
}

function getWorkspaceLabel(item: WorkspaceItem) {
  return item.workspaceName || item.workspaceCode
}

function ensureConcreteWorkspace() {
  if (props.mode === 'edit' && form.workspaceCode && form.workspaceCode !== 'ALL') {
    return
  }

  const concreteWorkspaces = getConcreteWorkspaces()
  if (!concreteWorkspaces.length) {
    return
  }

  const matchedWorkspace = concreteWorkspaces.find((item) => item.workspaceCode === form.workspaceCode)
  if (matchedWorkspace) {
    return
  }

  const preferredWorkspace =
    concreteWorkspaces.find((item) => item.current || item.default || item.isCurrent || item.isDefault) ||
    concreteWorkspaces[0]
  form.workspaceCode = preferredWorkspace.workspaceCode
}

async function loadUserOptions() {
  if (userOptionsLoaded || userOptionsLoading.value) {
    return
  }

  userOptionsLoading.value = true
  userOptionsError.value = ''
  try {
    users.value = await userApi.getUsers()
    userOptionsLoaded = true
  } catch (error) {
    userOptionsError.value = getRequestErrorMessage(error)
  } finally {
    userOptionsLoading.value = false
  }
}

async function loadWorkspaceOptions() {
  if (workspaceOptionsLoaded || workspaceOptionsLoading.value) {
    ensureConcreteWorkspace()
    return
  }

  workspaceOptionsLoading.value = true
  workspaceOptionsError.value = ''
  try {
    workspaceOptions.value = await workspaceApi.getSwitchableWorkspaces()
    workspaceOptionsLoaded = true
    ensureConcreteWorkspace()
  } catch (error) {
    workspaceOptionsError.value = getRequestErrorMessage(error)
  } finally {
    workspaceOptionsLoading.value = false
  }
}

async function loadCaseOptions(workspaceCode: string) {
  if (!workspaceCode || workspaceCode === 'ALL') {
    caseOptions.value = []
    loadedCaseOptionsWorkspaceCode = ''
    return
  }

  if (
    loadedCaseOptionsWorkspaceCode === workspaceCode ||
    (caseOptionsLoading.value && loadingCaseOptionsWorkspaceCode === workspaceCode)
  ) {
    return
  }

  const requestSeq = ++caseOptionsRequestSeq
  loadingCaseOptionsWorkspaceCode = workspaceCode
  caseOptionsLoading.value = true
  caseOptionsError.value = ''
  try {
    const page = await caseApi.getCases(workspaceCode, {
      pageNo: 1,
      pageSize: 50,
    })
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptions.value = Array.isArray(page.items) ? page.items : []
      loadedCaseOptionsWorkspaceCode = workspaceCode
    }
  } catch (error) {
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptions.value = []
      caseOptionsError.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === caseOptionsRequestSeq) {
      caseOptionsLoading.value = false
      loadingCaseOptionsWorkspaceCode = ''
    }
  }
}

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.defectDetail
      ? createDefectFormFromDetail(props.defectDetail)
      : props.mode === 'edit' && props.defectItem
        ? createDefectFormFromSummary(props.defectItem, props.defaultWorkspaceCode)
        : createDefaultDefectForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateDefectForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveDefectPayload(form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      void loadUserOptions()
      void loadWorkspaceOptions()
      if (activeWorkspaceCode.value !== 'ALL') {
        void loadCaseOptions(activeWorkspaceCode.value)
      }
    }
  },
)

watch(
  () => [props.defectItem, props.defectDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
      void loadWorkspaceOptions()
      if (activeWorkspaceCode.value !== 'ALL') {
        void loadCaseOptions(activeWorkspaceCode.value)
      }
    }
  },
)

watch(
  () => form.workspaceCode,
  (workspaceCode, oldWorkspaceCode) => {
    if (!props.modelValue || workspaceCode === oldWorkspaceCode) {
      return
    }

    form.relatedCaseId = ''
    void loadCaseOptions(workspaceCode)
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="1120px"
    modal-class="defect-dialog-overlay"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-dialog">
      <div class="defect-dialog__intro">
        <strong>{{ introTitle }}</strong>
        <span>保持当前后端字段契约，先把弹窗布局、字段节奏和按钮区收拢到旧项目方向。</span>
      </div>

      <div v-if="loadingDetail" class="defect-dialog__hint">正在加载缺陷详情...</div>
      <div v-else-if="detailErrorMessage" class="defect-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <AppButton size="small" @click="emit('retryDetail')">重试</AppButton>
      </div>

      <div class="defect-dialog__surface">
        <div class="defect-dialog__columns">
          <section class="defect-dialog__main">
            <div class="defect-dialog__section-header defect-dialog__section-header--stack">
              <h4>主要信息</h4>
              <span>填写缺陷标题和现象描述</span>
            </div>

            <label class="defect-dialog__field">
              <span class="is-required">缺陷标题</span>
              <el-input v-model="form.title" :disabled="loadingDetail" placeholder="请输入缺陷标题" />
            </label>

            <label class="defect-dialog__field">
              <span class="is-required">缺陷描述</span>
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="14"
                resize="none"
                :disabled="loadingDetail"
                placeholder="请输入复现现象、影响范围或必要上下文"
              />
            </label>
          </section>

          <aside class="defect-dialog__side">
            <div class="defect-dialog__section-header defect-dialog__section-header--stack">
              <h4>流转字段</h4>
              <span>保持当前后端契约，只调整视觉和信息层次</span>
            </div>

            <label class="defect-dialog__field">
              <span class="is-required">工作空间</span>
              <el-select
                v-model="form.workspaceCode"
                class="defect-dialog__select"
                :disabled="mode === 'edit' || loadingDetail || workspaceOptionsLoading"
                :loading="workspaceOptionsLoading"
                filterable
                placeholder="请选择工作空间"
              >
                <el-option
                  v-for="workspace in getConcreteWorkspaces()"
                  :key="workspace.workspaceCode"
                  :label="getWorkspaceLabel(workspace)"
                  :value="workspace.workspaceCode"
                >
                  <div class="defect-dialog__option">
                    <span>{{ getWorkspaceLabel(workspace) }}</span>
                    <small>{{ workspace.workspaceCode }}</small>
                  </div>
                </el-option>
              </el-select>
              <small v-if="workspaceOptionsError" class="defect-dialog__field-error">{{ workspaceOptionsError }}</small>
            </label>

            <label class="defect-dialog__field">
              <span class="is-required">处理人</span>
              <el-select
                v-model="form.assigneeId"
                class="defect-dialog__select"
                :disabled="loadingDetail || userOptionsLoading"
                :loading="userOptionsLoading"
                filterable
                placeholder="请选择处理人"
              >
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="getUserLabel(user)"
                  :value="String(user.id)"
                >
                  <div class="defect-dialog__option">
                    <span>{{ getUserLabel(user) }}</span>
                    <small>{{ user.username }}</small>
                  </div>
                </el-option>
              </el-select>
              <small v-if="userOptionsError" class="defect-dialog__field-error">{{ userOptionsError }}</small>
            </label>

            <div class="defect-dialog__field">
              <span class="is-required">优先级</span>
              <div class="defect-dialog__segment is-four">
                <button
                  v-for="item in defectPriorityOptions"
                  :key="item.value"
                  type="button"
                  :class="{ 'is-active': form.priority === item.value }"
                  :disabled="loadingDetail"
                  @click="form.priority = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <label class="defect-dialog__field">
              <span class="is-required">严重级别</span>
              <el-select
                v-model="form.severity"
                class="defect-dialog__select"
                :disabled="loadingDetail"
              >
                <el-option
                  v-for="item in defectSeverityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </label>

            <label class="defect-dialog__field">
              <span>关联用例</span>
              <el-select
                v-model="form.relatedCaseId"
                class="defect-dialog__select"
                :disabled="loadingDetail || caseOptionsLoading"
                :loading="caseOptionsLoading"
                clearable
                filterable
                placeholder="可选"
              >
                <el-option
                  v-for="item in caseOptions"
                  :key="item.id"
                  :label="getCaseLabel(item)"
                  :value="String(item.id)"
                >
                  <div class="defect-dialog__option">
                    <span>{{ item.title || '-' }}</span>
                    <small>{{ item.caseNo || `#${item.id}` }}</small>
                  </div>
                </el-option>
              </el-select>
              <small v-if="caseOptionsError" class="defect-dialog__field-error">{{ caseOptionsError }}</small>
            </label>

            <label class="defect-dialog__field">
              <span>标签</span>
              <el-input
                v-model="form.tagsText"
                :disabled="loadingDetail"
                placeholder="多个标签用逗号或换行分隔"
              />
            </label>
          </aside>
        </div>
      </div>

      <p v-if="formError.message" class="defect-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="defect-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
        <AppButton
          type="primary"
          :loading="saving"
          :disabled="loadingDetail || Boolean(detailErrorMessage)"
          @click="submit"
        >
          保存
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-dialog {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  gap: var(--app-space-4);
}

:global(.defect-dialog-overlay .el-dialog) {
  display: flex;
  height: min(760px, calc(100vh - 72px));
  max-height: calc(100vh - 72px);
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--app-shadow-overlay);
}

:global(.defect-dialog-overlay .el-dialog__header) {
  min-height: 64px;
  margin: 0;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--app-border-soft);
}

:global(.defect-dialog-overlay .el-dialog__title) {
  color: var(--app-text-primary);
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

:global(.defect-dialog-overlay .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 20px 24px 16px;
  overflow: hidden;
}

:global(.defect-dialog-overlay .el-dialog__footer) {
  padding: 14px 24px 18px;
  border-top: 1px solid var(--app-border-soft);
}

.defect-dialog__intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 2px;
}

.defect-dialog__intro strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
  line-height: 20px;
}

.defect-dialog__intro span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__surface {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.defect-dialog__columns {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 0;
}

.defect-dialog__main,
.defect-dialog__side {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  flex-direction: column;
  gap: 16px;
}

.defect-dialog__main {
  padding: 18px 22px 20px;
}

.defect-dialog__side {
  padding: 18px 18px 20px;
  border-left: 1px solid var(--app-border-soft);
  background: #fbfcff;
}

.defect-dialog__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-dialog__section-header--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-dialog__section-header h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
  line-height: 20px;
}

.defect-dialog__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.defect-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 20px;
}

.defect-dialog__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.defect-dialog__field :deep(.el-input__wrapper),
.defect-dialog__field :deep(.el-textarea__inner),
.defect-dialog__field :deep(.el-select__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}

.defect-dialog__field :deep(.el-textarea__inner) {
  min-height: 248px;
  padding: 12px 14px;
  line-height: 1.75;
}

.defect-dialog__select {
  width: 100%;
}

.defect-dialog__option {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.defect-dialog__option span {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__option small {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__field-error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.defect-dialog__segment.is-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.defect-dialog__segment button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.defect-dialog__segment button:hover:not(:disabled) {
  border-color: #bfd7ff;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-dialog__segment button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.defect-dialog__hint,
.defect-dialog__error-panel,
.defect-dialog__error {
  padding: 10px 12px;
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.defect-dialog__hint {
  border: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
}

.defect-dialog__error-panel,
.defect-dialog__error {
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.defect-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-dialog__error {
  margin: 0;
}

.defect-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.defect-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

.defect-dialog__footer :deep(.app-button) {
  min-width: 88px;
  height: 36px;
}

@media (max-width: 1200px) {
  .defect-dialog__columns {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .defect-dialog__side {
    border-top: 1px solid var(--app-border-soft);
    border-left: 0;
  }
}
</style>
