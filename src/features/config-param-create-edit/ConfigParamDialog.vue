<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { configParamTypeOptions, configStatusOptions, type ParamSetItem } from '@/entities/config'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildCreateParamPayload,
  createConfigParamFormFromItem,
  createDefaultConfigParamForm,
  createDefaultWebUiVariable,
  parseWebUiVariables,
  type ConfigParamDialogMode,
  type ConfigParamForm,
  validateConfigParamForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigParamDialogMode
    param?: ParamSetItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    param: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateParamPayload>]
}>()

const form = reactive<ConfigParamForm>(createDefaultConfigParamForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.param
      ? createConfigParamFormFromItem(props.param)
      : createDefaultConfigParamForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
}

function submit() {
  const error = validateConfigParamForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateParamPayload(form))
}

function addVariable() {
  form.variables.push(createDefaultWebUiVariable())
}

function removeVariable(index: number) {
  form.variables.splice(index, 1)
  if (form.variables.length === 0) {
    addVariable()
  }
}

async function importVariablesFromJson() {
  const input = window.prompt('请输入变量 JSON 数组，例如：[{"name":"USERNAME","value":"admin","sensitive":false}]')
  if (input === null) {
    return
  }

  const variables = parseWebUiVariables(input)
  if (variables.length === 0) {
    formError.message = '未识别到有效变量，请检查 JSON 格式'
    return
  }

  form.variables.splice(0, form.variables.length, ...variables)
  formError.message = ''
  ElMessage.success(`已导入 ${variables.length} 个变量`)
}

async function exportVariablesToJson() {
  const text = JSON.stringify(
    form.variables
      .filter(variable => variable.name.trim())
      .map(variable => ({
        name: variable.name.trim(),
        value: variable.value,
        sensitive: variable.sensitive,
        description: variable.description.trim(),
      })),
    null,
    2,
  )

  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('变量 JSON 已复制到剪贴板')
  } catch {
    formError.message = text
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => props.param,
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
    :title="mode === 'create' ? '新增参数' : '编辑参数'"
    width="760px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-param-dialog">
      <div class="config-param-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </div>

      <div class="config-param-dialog__field">
        <span>参数名 *</span>
        <el-input v-model="form.paramName" placeholder="例如：REQUEST_TIMEOUT" />
      </div>

      <div class="config-param-dialog__field">
        <span>参数类型</span>
        <div class="config-param-dialog__segment">
          <button
            v-for="item in configParamTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.paramType === item.value }"
            @click="form.paramType = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="form.paramType !== 'WEB_UI_VARIABLE_SET'" class="config-param-dialog__field">
        <span>参数值 *</span>
        <el-input
          v-model="form.value"
          :type="form.sensitive ? 'password' : 'text'"
          placeholder="请输入参数值"
        />
      </div>

      <div v-if="form.paramType !== 'WEB_UI_VARIABLE_SET'" class="config-param-dialog__field">
        <span>说明</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该参数的用途或取值规则"
        />
      </div>

      <label v-if="form.paramType !== 'WEB_UI_VARIABLE_SET'" class="config-param-dialog__checkbox">
        <input v-model="form.sensitive" type="checkbox">
        <span>敏感参数（密码、密钥等）</span>
      </label>

      <div v-else class="config-param-dialog__field">
        <div class="config-param-dialog__toolbar">
          <span>变量列表 *</span>
          <div>
            <el-button size="small" @click="importVariablesFromJson">JSON 导入</el-button>
            <el-button size="small" @click="exportVariablesToJson">JSON 导出</el-button>
            <el-button size="small" type="primary" @click="addVariable">新增变量</el-button>
          </div>
        </div>

        <el-table class="config-param-dialog__table" :data="form.variables" border>
          <el-table-column label="变量名" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="USERNAME" />
            </template>
          </el-table-column>
          <el-table-column label="变量值" min-width="180">
            <template #default="{ row }">
              <el-input
                v-model="row.value"
                :type="row.sensitive ? 'password' : 'text'"
                placeholder="变量值"
                show-password
              />
            </template>
          </el-table-column>
          <el-table-column label="敏感" width="82" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.sensitive" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.description" placeholder="用途说明" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link @click="removeVariable($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="config-param-dialog__field">
        <span>状态</span>
        <div class="config-param-dialog__segment is-two">
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

      <p v-if="formError.message" class="config-param-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-param-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-param-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-param-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-param-dialog__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.config-param-dialog__toolbar > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-param-dialog__toolbar > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-param-dialog__table {
  width: 100%;
}

.config-param-dialog__segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.config-param-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-param-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-param-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.config-param-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-param-dialog__checkbox {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-param-dialog__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--app-primary);
}

.config-param-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
