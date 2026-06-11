<script setup lang="ts">
import { computed } from 'vue'

import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

import { getApiMethodTone } from '../lib/format'

const props = defineProps<{
  method: string
}>()

const methodText = computed(() => String(props.method || 'GET').toUpperCase())
const tone = computed(() => getApiMethodTone(methodText.value))
</script>

<template>
  <AppStatusBadge :label="methodText" :tone="tone" />
</template>
