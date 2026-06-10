<script setup lang="ts">
defineProps<{
  modelValue: boolean
  title?: string
  size?: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <div class="app-drawer__footer">
        <slot name="footer" />
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.app-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
  padding: var(--app-space-4) var(--app-space-6);
  border-top: 1px solid var(--app-border-soft);
}
</style>
