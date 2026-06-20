<script setup lang="ts">
import { computed } from 'vue'

import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

import { getWebUiStepTypeOption } from '../model/options'

const props = defineProps<{
  type?: string | null
}>()

const option = computed(() => getWebUiStepTypeOption(props.type))
const label = computed(() => option.value?.label || props.type || '-')
const tone = computed(() => option.value?.tone || 'default')
</script>

<template>
  <AppStatusBadge :label="label" :tone="tone" />
</template>
