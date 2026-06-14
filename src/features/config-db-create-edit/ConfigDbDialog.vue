<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'

import { configDbTypeOptions, configStatusOptions, type DbConnectionItem } from '@/entities/config'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  applyDbTypeDefaults,
  buildCreateDbConnectionPayload,
  createConfigDbFormFromItem,
  createDefaultConfigDbForm,
  type ConfigDbDialogMode,
  type ConfigDbForm,
  validateConfigDbForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigDbDialogMode
    dbConnection?: DbConnectionItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    dbConnection: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateDbConnectionPayload>]
}>()

const form = reactive<ConfigDbForm>(createDefaultConfigDbForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const passwordVisible = ref(false)

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.dbConnection
      ? createConfigDbFormFromItem(props.dbConnection)
      : createDefaultConfigDbForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
  passwordVisible.value = false
}

function selectDbType(dbType: string) {
  applyDbTypeDefaults(form, dbType)
}

function submit() {
  const error = validateConfigDbForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateDbConnectionPayload(form, {
    includePassword: props.mode === 'create' || Boolean(form.password),
  }))
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
  () => props.dbConnection,
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
    :title="mode === 'create' ? '新增数据库连接' : '编辑数据库连接'"
    width="672px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-db-dialog">
      <div class="config-db-dialog__field">
        <span>目标空间</span>
        <el-input v-model="form.workspaceCode" placeholder="ALL" />
      </div>

      <div class="config-db-dialog__field">
        <span>连接名称 *</span>
        <el-input v-model="form.connectionName" placeholder="例如：主数据库（测试）" />
      </div>

      <div class="config-db-dialog__field">
        <span>数据库类型</span>
        <div class="config-db-dialog__segment">
          <button
            v-for="item in configDbTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.dbType === item.value }"
            @click="selectDbType(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>主机地址 *</span>
          <el-input v-model="form.host" placeholder="localhost 或 IP" />
        </div>
        <div class="config-db-dialog__field">
          <span>端口 *</span>
          <el-input v-model="form.port" placeholder="3306" />
        </div>
      </div>

      <div class="config-db-dialog__field">
        <span>数据库名 *</span>
        <el-input v-model="form.database" placeholder="数据库名称" />
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>用户名</span>
          <el-input v-model="form.username" autocomplete="username" placeholder="用户名" />
        </div>
        <div class="config-db-dialog__field">
          <span>密码</span>
          <el-input
            v-model="form.password"
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            :placeholder="mode === 'edit' ? '留空沿用旧密码' : '密码'"
          >
            <template #suffix>
              <button
                type="button"
                class="config-db-dialog__password-toggle"
                :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                @click="passwordVisible = !passwordVisible"
              >
                <el-icon>
                  <View v-if="!passwordVisible" />
                  <Hide v-else />
                </el-icon>
              </button>
            </template>
          </el-input>
        </div>
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>连接池大小</span>
          <el-input-number v-model="form.poolMax" :min="1" :max="200" />
        </div>
        <div class="config-db-dialog__field">
          <span>超时时间（ms）</span>
          <el-input-number v-model="form.timeoutMs" :min="1000" :max="120000" :step="500" />
        </div>
      </div>

      <div class="config-db-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该连接的用途或注意事项"
        />
      </div>

      <div class="config-db-dialog__field">
        <span>状态</span>
        <div class="config-db-dialog__segment is-two">
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

      <p v-if="formError.message" class="config-db-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-db-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.config-db-dialog__grid {
  display: grid;
  gap: var(--app-space-4);
}

.config-db-dialog__grid.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-db-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.config-db-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-db-dialog__segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.config-db-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-db-dialog__segment button {
  min-height: var(--app-control-height-md);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-db-dialog__segment button:hover {
  background: var(--app-bg-page);
}

.config-db-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.config-db-dialog__password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.config-db-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .config-db-dialog__grid.is-two,
  .config-db-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
