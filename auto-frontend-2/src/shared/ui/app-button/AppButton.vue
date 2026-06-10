<script setup lang="ts">
import type { ButtonProps } from 'element-plus'

withDefaults(
  defineProps<{
    type?: ButtonProps['type']
    size?: ButtonProps['size']
    icon?: ButtonProps['icon']
    loading?: boolean
    disabled?: boolean
    plain?: boolean
  }>(),
  {
    type: 'default',
    size: 'default',
    icon: undefined,
  },
)
</script>

<template>
  <el-button
    class="app-button"
    :type="type"
    :size="size"
    :icon="icon"
    :loading="loading"
    :disabled="disabled"
    :plain="plain"
  >
    <slot />
  </el-button>
</template>
