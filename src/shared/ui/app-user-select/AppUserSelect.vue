<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { workspaceApi, type WorkspaceMemberItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'

const props = withDefaults(
  defineProps<{
    modelValue: string
    workspaceCode?: string
    disabled?: boolean
    clearable?: boolean
    placeholder?: string
    fallbackLabel?: string | null
  }>(),
  {
    workspaceCode: '',
    placeholder: '请选择处理人',
    fallbackLabel: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const members = ref<WorkspaceMemberItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
let requestSeq = 0

const normalizedWorkspaceCode = computed(() => props.workspaceCode || '')
const hasConcreteWorkspace = computed(() => Boolean(normalizedWorkspaceCode.value && normalizedWorkspaceCode.value !== 'ALL'))
const selectedMember = computed(() => members.value.find(member => String(member.userId) === props.modelValue) ?? null)
const selectedLabel = computed(() => selectedMember.value ? getMemberLabel(selectedMember.value) : props.fallbackLabel || '')
const selectDisabled = computed(() => props.disabled || !hasConcreteWorkspace.value)
const selectPlaceholder = computed(() => {
  if (!hasConcreteWorkspace.value) {
    return '请先选择工作空间'
  }
  return props.placeholder
})

function getMemberLabel(member: WorkspaceMemberItem) {
  return member.displayName || member.username || `用户 ${member.userId}`
}

async function loadMembers(workspaceCode: string) {
  const currentSeq = ++requestSeq
  if (!workspaceCode || workspaceCode === 'ALL') {
    members.value = []
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const nextMembers = await workspaceApi.getWorkspaceMembers(workspaceCode)
    if (currentSeq === requestSeq) {
      members.value = nextMembers
    }
  } catch (error) {
    if (currentSeq === requestSeq) {
      members.value = []
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (currentSeq === requestSeq) {
      loading.value = false
    }
  }
}

watch(
  normalizedWorkspaceCode,
  (workspaceCode) => {
    void loadMembers(workspaceCode)
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-user-select">
    <el-select
      :model-value="modelValue"
      class="app-user-select__control"
      :disabled="selectDisabled"
      :loading="loading"
      :clearable="clearable"
      filterable
      :placeholder="selectPlaceholder"
      @update:model-value="emit('update:modelValue', String($event || ''))"
    >
      <template v-if="selectedLabel" #label>
        <div class="app-user-select__selected">
          <span class="app-user-select__name">{{ selectedLabel }}</span>
        </div>
      </template>
      <el-option
        v-for="member in members"
        :key="member.userId"
        :label="getMemberLabel(member)"
        :value="String(member.userId)"
      >
        <div class="app-user-select__option">
          <span class="app-user-select__name">{{ getMemberLabel(member) }}</span>
        </div>
      </el-option>
    </el-select>
    <small v-if="errorMessage" class="app-user-select__error">{{ errorMessage }}</small>
  </div>
</template>

<style scoped>
.app-user-select {
  display: grid;
  min-width: 0;
  gap: var(--app-space-1);
}

.app-user-select__control {
  width: 100%;
}

.app-user-select__selected,
.app-user-select__option {
  display: flex;
  min-width: 0;
  align-items: center;
}

.app-user-select__selected {
  width: 100%;
}

.app-user-select__name {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-user-select__error {
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}
</style>
