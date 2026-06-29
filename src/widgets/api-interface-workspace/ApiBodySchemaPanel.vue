<script setup lang="ts">
import type { ApiSchemaFieldInput } from '@/entities/api-automation'

defineProps<{
  fields: ApiSchemaFieldInput[]
  schemaFieldDepth: (field: ApiSchemaFieldInput) => number
  schemaFieldName: (field: ApiSchemaFieldInput) => string
  schemaFieldTypeClass: (field: ApiSchemaFieldInput) => string
  schemaFieldType: (field: ApiSchemaFieldInput) => string
  schemaEditableValue: (value: unknown) => string
  schemaFieldEnum: (field: ApiSchemaFieldInput) => string
  schemaFieldLimit: (field: ApiSchemaFieldInput) => string
}>()

const emit = defineEmits<{
  generateFromJson: []
  updateRequired: [field: ApiSchemaFieldInput, value: unknown]
  updateFieldValue: [field: ApiSchemaFieldInput, key: 'description' | 'example' | 'defaultValue', value: string]
}>()
</script>

<template>
  <div class="api-schema-panel is-body-schema">
    <div class="api-schema-actions">
      <button type="button" class="api-schema-action" @click="emit('generateFromJson')">从 JSON 生成 Schema</button>
    </div>
    <div v-if="!fields.length" class="api-empty-body">当前请求体暂无 Schema 定义</div>
    <div v-else class="api-schema-table">
      <div class="api-schema-header">
        <span>字段</span>
        <span>类型</span>
        <span>必填</span>
        <span>描述</span>
        <span>示例</span>
        <span>默认值</span>
        <span>枚举/限制</span>
      </div>
      <div v-for="field in fields" :key="`body-schema-${field.fieldPath || field.name}`" class="api-schema-row">
        <span class="api-schema-field" :style="{ paddingLeft: `${schemaFieldDepth(field) * 16}px` }">{{ schemaFieldName(field) }}</span>
        <span :class="['api-schema-type', schemaFieldTypeClass(field)]">{{ schemaFieldType(field) }}</span>
        <span><el-switch :model-value="Boolean(field.required)" size="small" @change="emit('updateRequired', field, $event)" /></span>
        <span><el-input :model-value="field.description || ''" size="small" placeholder="描述" @input="emit('updateFieldValue', field, 'description', String($event))" /></span>
        <span><el-input :model-value="schemaEditableValue(field.example)" size="small" placeholder="示例值" @input="emit('updateFieldValue', field, 'example', String($event))" /></span>
        <span><el-input :model-value="schemaEditableValue(field.defaultValue)" size="small" placeholder="默认值" @input="emit('updateFieldValue', field, 'defaultValue', String($event))" /></span>
        <span class="api-schema-muted">{{ schemaFieldEnum(field) !== '-' ? schemaFieldEnum(field) : schemaFieldLimit(field) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-empty-body {
  display: flex;
  width: 100%;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-schema-panel {
  min-height: 300px;
}

.api-schema-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.api-schema-action {
  min-height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.api-schema-action:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}

.api-schema-table {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-schema-header,
.api-schema-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.35fr) 130px 72px minmax(180px, 1.2fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr);
  align-items: center;
  column-gap: 12px;
  min-width: 1180px;
  padding: 0 12px;
}

.api-schema-header {
  height: 38px;
  border-bottom: 1px solid var(--app-border);
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-schema-row {
  min-height: 42px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-schema-row:last-child {
  border-bottom: 0;
}

.api-schema-field {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-muted {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-type {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.api-schema-type.is-string {
  background: #ecfdf3;
  color: #15803d;
}

.api-schema-type.is-number {
  background: #eff6ff;
  color: #2563eb;
}

.api-schema-type.is-boolean {
  background: #fef3c7;
  color: #b45309;
}

.api-schema-type.is-object,
.api-schema-type.is-array {
  background: #f5f3ff;
  color: #7c3aed;
}

.api-schema-row :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--app-border-soft) inset;
}

.api-schema-row :deep(.el-input__inner) {
  height: 28px;
  font-size: 12px;
}
</style>
