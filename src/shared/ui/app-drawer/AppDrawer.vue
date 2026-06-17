<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  size?: string | number
  withHeader?: boolean
  drawerClass?: string
}>(), {
  withHeader: true,
  drawerClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :with-header="withHeader"
    :class="drawerClass"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
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
