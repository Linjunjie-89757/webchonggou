<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import {
  configApi,
  configEnvTypeOptions,
  configParamTypeOptions,
  configStatusOptions,
  type MockApplicationItem,
  type EnvConfigItem,
  type ParamSetItem,
} from '@/entities/config'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateEnvPayload,
  createConfigEnvFormFromItem,
  createDefaultConfigEnvForm,
  type ConfigEnvDialogMode,
  type ConfigEnvForm,
  validateConfigEnvForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigEnvDialogMode
    env?: EnvConfigItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    env: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateEnvPayload>]
}>()

const form = reactive<ConfigEnvForm>(createDefaultConfigEnvForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const variableSets = ref<ParamSetItem[]>([])
const mockApplications = ref<MockApplicationItem[]>([])
const loadingVariableSets = ref(false)
const loadingMockApplications = ref(false)
let variableSetRequestSeq = 0
let mockApplicationRequestSeq = 0

const paramTypeLabelMap = new Map<string, string>(configParamTypeOptions.map(item => [item.value, item.label]))

const enabledVariableSets = computed(() => variableSets.value.filter(item => item.status !== 0))
const enabledMockApplications = computed(() => mockApplications.value.filter(item => item.status !== 0))

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.env
      ? createConfigEnvFormFromItem(props.env)
      : createDefaultConfigEnvForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateConfigEnvForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateEnvPayload(form))
}

async function loadVariableSets() {
  const requestId = ++variableSetRequestSeq
  loadingVariableSets.value = true
  try {
    const page = await configApi.getSettingsParams(props.defaultWorkspaceCode, {
      status: 1,
    })
    if (requestId === variableSetRequestSeq) {
      variableSets.value = Array.isArray(page.items) ? page.items : []
    }
  } catch (error) {
    if (requestId === variableSetRequestSeq) {
      formError.message = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === variableSetRequestSeq) {
      loadingVariableSets.value = false
    }
  }
}

async function loadMockApplications() {
  const requestId = ++mockApplicationRequestSeq
  loadingMockApplications.value = true
  try {
    const page = await configApi.getMockApplications(props.defaultWorkspaceCode, {
      status: 1,
    })
    if (requestId === mockApplicationRequestSeq) {
      mockApplications.value = Array.isArray(page.items) ? page.items : []
    }
  } catch (error) {
    if (requestId === mockApplicationRequestSeq) {
      formError.message = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === mockApplicationRequestSeq) {
      loadingMockApplications.value = false
    }
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
      void loadVariableSets()
      void loadMockApplications()
    }
  },
)

watch(
  () => props.env,
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增环境' : '编辑环境'"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-env-dialog">
      <div class="config-env-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </div>

      <div class="config-env-dialog__field">
        <span>环境名称 *</span>
        <el-input v-model="form.envName" placeholder="例如：测试环境" />
      </div>

      <div class="config-env-dialog__field">
        <span>环境类型</span>
        <div class="config-env-dialog__segment">
          <button
            v-for="item in configEnvTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.envType === item.value }"
            @click="form.envType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="config-env-dialog__field">
        <span>Base URL *</span>
        <el-input v-model="form.baseUrl" placeholder="https://api.example.com" />
      </div>

      <div v-if="form.envType === 'WEB_UI'" class="config-env-dialog__field">
        <span>Web UI 配置</span>
        <div class="config-env-dialog__grid">
          <label>
            <span>浏览器</span>
            <el-select v-model="form.browserType">
              <el-option label="Chromium" value="CHROMIUM" />
              <el-option label="Firefox" value="FIREFOX" />
              <el-option label="WebKit" value="WEBKIT" />
            </el-select>
          </label>
          <label>
            <span>默认超时</span>
            <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
          </label>
          <label>
            <span>视口宽度</span>
            <el-input-number v-model="form.viewportWidth" :min="320" :max="7680" :step="10" controls-position="right" />
          </label>
          <label>
            <span>视口高度</span>
            <el-input-number v-model="form.viewportHeight" :min="240" :max="4320" :step="10" controls-position="right" />
          </label>
        </div>
        <div class="config-env-dialog__switches">
          <label>
            <span>无头模式</span>
            <el-switch v-model="form.headless" />
          </label>
          <label>
            <span>忽略 HTTPS 错误</span>
            <el-switch v-model="form.ignoreHttpsErrors" />
          </label>
        </div>
        <el-select
          v-model="form.defaultVariableSetId"
          clearable
          filterable
          :loading="loadingVariableSets"
          placeholder="默认变量集"
        >
          <el-option
            v-for="variableSet in enabledVariableSets"
            :key="variableSet.id"
            :label="`${variableSet.paramName}（${paramTypeLabelMap.get(variableSet.paramType) ?? variableSet.paramType}）`"
            :value="variableSet.id"
          />
        </el-select>
      </div>

      <div v-if="form.envType !== 'WEB_UI'" class="config-env-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该环境的用途或注意事项"
        />
      </div>

      <div v-if="form.envType !== 'WEB_UI'" class="config-env-dialog__field">
        <span>默认变量集</span>
        <el-select
          v-model="form.defaultVariableSetId"
          clearable
          filterable
          :loading="loadingVariableSets"
          placeholder="请选择默认变量集"
        >
          <el-option
            v-for="variableSet in enabledVariableSets"
            :key="variableSet.id"
            :label="`${variableSet.paramName}（${paramTypeLabelMap.get(variableSet.paramType) ?? variableSet.paramType}）`"
            :value="variableSet.id"
          />
        </el-select>
      </div>

      <div class="config-env-dialog__field">
        <span>关联 Mock 应用</span>
        <el-select
          v-model="form.mockApplicationId"
          clearable
          filterable
          :loading="loadingMockApplications"
          placeholder="请选择 Mock 应用"
        >
          <el-option
            v-for="mockApplication in enabledMockApplications"
            :key="mockApplication.id"
            :label="`${mockApplication.appName}（${mockApplication.appCode}）`"
            :value="mockApplication.id"
          />
        </el-select>
      </div>

      <div v-if="form.envType !== 'WEB_UI'" class="config-env-dialog__grid">
        <label>
          <span>默认超时</span>
          <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </label>
        <label>
          <span>忽略 SSL</span>
          <el-switch v-model="form.ignoreHttpsErrors" />
        </label>
      </div>

      <div class="config-env-dialog__field">
        <span>状态</span>
        <div class="config-env-dialog__segment is-two">
          <button
            v-for="item in configStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.status === item.value }"
            @click="form.status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError.message" class="config-env-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-env-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-env-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-env-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-env-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-env-dialog__grid label,
.config-env-dialog__switches label {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-env-dialog__switches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.config-env-dialog :deep(.el-select),
.config-env-dialog :deep(.el-input-number) {
  width: 100%;
}

.config-env-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.config-env-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-env-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-env-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.config-env-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-env-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
