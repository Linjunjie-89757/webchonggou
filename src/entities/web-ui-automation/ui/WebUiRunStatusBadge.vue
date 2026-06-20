<script setup lang="ts">
import { computed } from 'vue'

import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

import { getWebUiRunStatusOption, getWebUiRunStepStatusOption } from '../model/options'

const props = withDefaults(
  defineProps<{
    status?: string | null
    step?: boolean
  }>(),
  {
    step: false,
  },
)

const option = computed(() => (props.step
  ? getWebUiRunStepStatusOption(props.status)
  : getWebUiRunStatusOption(props.status)))
const label = computed(() => option.value?.label || props.status || '-')
const tone = computed(() => option.value?.tone || 'default')
</script>

<template>
  <AppStatusBadge :label="label" :tone="tone" />
</template>
