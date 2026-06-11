<script setup lang="ts">
import { computed } from 'vue'

import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

import { getApiRunResultMeta } from '../lib/format'

const props = defineProps<{
  result?: string | null
}>()

const meta = computed(() => getApiRunResultMeta(props.result))
</script>

<template>
  <AppStatusBadge :label="meta.label" :tone="meta.tone" />
</template>
