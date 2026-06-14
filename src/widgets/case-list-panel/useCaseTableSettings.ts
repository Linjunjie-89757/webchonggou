import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export type CaseTableColumnKey =
  | 'caseNo'
  | 'title'
  | 'priority'
  | 'sourceType'
  | 'reviewStatus'
  | 'reviewedByName'
  | 'reviewedAt'
  | 'executionStatus'
  | 'executorName'
  | 'executedAt'
  | 'workspaceName'
  | 'directoryName'
  | 'createdByName'
  | 'createdAt'
  | 'updatedByName'
  | 'updatedAt'

export interface CaseTableColumnDefinition {
  key: CaseTableColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
}

interface UseCaseTableSettingsOptions {
  storageKey: string
  columns: MaybeRefOrGetter<CaseTableColumnDefinition[]>
}

interface PersistedCaseTableSettings {
  columns?: Partial<Record<CaseTableColumnKey, boolean>>
  columnOrder?: CaseTableColumnKey[]
  pageSize?: number
}

export function useCaseTableSettings(options: UseCaseTableSettingsOptions) {
  const settingsVisible = ref(false)
  const draggingColumnKey = ref<CaseTableColumnKey | null>(null)
  const columnVisibility = ref<Partial<Record<CaseTableColumnKey, boolean>>>({})
  const columnOrder = ref<CaseTableColumnKey[]>([])
  const pageSize = ref<number | null>(null)

  const allColumns = computed(() => toValue(options.columns))
  const requiredColumns = computed(() => allColumns.value.filter(column => column.required))
  const optionalColumns = computed(() => allColumns.value.filter(column => !column.required))

  const orderedColumns = computed(() => columnOrder.value
    .map(key => allColumns.value.find(column => column.key === key))
    .filter((column): column is CaseTableColumnDefinition => Boolean(column)))

  const visibleColumns = computed(() => orderedColumns.value.filter(column => (
    column.required || Boolean(columnVisibility.value[column.key])
  )))

  const drawerColumns = computed(() => orderedColumns.value.map(column => ({
    key: column.key,
    label: column.label,
    required: Boolean(column.required),
    visible: column.required ? true : Boolean(columnVisibility.value[column.key]),
    draggable: !column.required,
  })))

  function buildDefaultOrder() {
    return [
      ...requiredColumns.value.map(column => column.key),
      ...optionalColumns.value.map(column => column.key),
    ]
  }

  function normalizeColumnOrder(nextOrder?: CaseTableColumnKey[]) {
    const requiredKeys = requiredColumns.value.map(column => column.key)
    const optionalKeys = optionalColumns.value.map(column => column.key)
    const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
    const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
    return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
  }

  function buildDefaultVisibility() {
    return allColumns.value.reduce<Partial<Record<CaseTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required ? true : Boolean(column.defaultVisible)
      return result
    }, {})
  }

  function syncState() {
    const currentVisibility = columnVisibility.value
    columnOrder.value = normalizeColumnOrder(columnOrder.value)
    columnVisibility.value = allColumns.value.reduce<Partial<Record<CaseTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (currentVisibility[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  }

  function persist() {
    if (typeof localStorage === 'undefined') {
      return
    }

    const payload: PersistedCaseTableSettings = {
      columns: columnVisibility.value,
      columnOrder: columnOrder.value,
      pageSize: pageSize.value ?? undefined,
    }

    localStorage.setItem(options.storageKey, JSON.stringify(payload))
  }

  function load() {
    const defaultOrder = buildDefaultOrder()
    const defaultVisibility = buildDefaultVisibility()

    if (typeof localStorage === 'undefined') {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
      return
    }

    const raw = localStorage.getItem(options.storageKey)
    if (!raw) {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
      return
    }

    try {
      const parsed = JSON.parse(raw) as PersistedCaseTableSettings
      columnOrder.value = normalizeColumnOrder(parsed.columnOrder)
      pageSize.value = typeof parsed.pageSize === 'number' ? parsed.pageSize : null
      columnVisibility.value = allColumns.value.reduce<Partial<Record<CaseTableColumnKey, boolean>>>((result, column) => {
        result[column.key] = column.required
          ? true
          : (parsed.columns?.[column.key] ?? Boolean(column.defaultVisible))
        return result
      }, {})
    } catch {
      columnOrder.value = defaultOrder
      columnVisibility.value = defaultVisibility
    }

    syncState()
  }

  function reset() {
    columnOrder.value = buildDefaultOrder()
    columnVisibility.value = buildDefaultVisibility()
    pageSize.value = null
    persist()
  }

  function updatePageSize(value: number) {
    pageSize.value = value
    persist()
  }

  function toggleColumnVisibility(key: CaseTableColumnKey, value: boolean | string | number) {
    const targetColumn = allColumns.value.find(column => column.key === key)
    if (!targetColumn || targetColumn.required) {
      return
    }

    columnVisibility.value = {
      ...columnVisibility.value,
      [key]: Boolean(value),
    }
    persist()
  }

  function canDragColumn(key: CaseTableColumnKey) {
    return optionalColumns.value.some(column => column.key === key)
  }

  function handleDragStart(key: CaseTableColumnKey) {
    if (!canDragColumn(key)) {
      return
    }

    draggingColumnKey.value = key
  }

  function handleDragEnd() {
    draggingColumnKey.value = null
  }

  function moveColumnToTarget(targetKey: CaseTableColumnKey) {
    const sourceKey = draggingColumnKey.value
    if (!sourceKey || sourceKey === targetKey || !canDragColumn(sourceKey) || !canDragColumn(targetKey)) {
      return
    }

    const nextOrder = [...columnOrder.value]
    const sourceIndex = nextOrder.indexOf(sourceKey)
    const targetIndex = nextOrder.indexOf(targetKey)
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    const [sourceColumn] = nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, sourceColumn)
    columnOrder.value = normalizeColumnOrder(nextOrder)
    draggingColumnKey.value = null
    persist()
  }

  watch(allColumns, syncState, { deep: true })

  return {
    settingsVisible,
    draggingColumnKey,
    pageSize,
    drawerColumns,
    visibleColumns,
    load,
    reset,
    updatePageSize,
    toggleColumnVisibility,
    handleDragStart,
    handleDragEnd,
    moveColumnToTarget,
  }
}
