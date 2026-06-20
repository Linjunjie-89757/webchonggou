<script setup lang="ts">
import { computed } from 'vue'

import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

import { getWebUiCaseStatusOption } from '../model/options'

const props = defineProps<{
  status?: string | null
}>()

const option = computed(() => getWebUiCaseStatusOption(props.status))
const label = computed(() => option.value?.label || props.status || '-')
const tone = computed(() => option.value?.tone || 'default')
</script>

<template>
  <AppStatusBadge :label="label" :tone="tone" />
</template>
