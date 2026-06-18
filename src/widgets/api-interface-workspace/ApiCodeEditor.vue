<template>
  <div class="api-code-editor" :style="{ height }">
    <div v-if="showToolbar" class="api-code-editor__toolbar">
      <button type="button" class="api-code-editor__format" @click="formatDocument">格式化</button>
    </div>
    <div ref="containerRef" class="api-code-editor__body"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

type ApiCodeLanguage = 'javascript' | 'json' | 'sql' | 'text' | 'xml'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  language?: ApiCodeLanguage
  height?: string
  readOnly?: boolean
  showFormatButton?: boolean
  placeholder?: string
}>(), {
  language: 'javascript',
  height: '260px',
  readOnly: false,
  showFormatButton: true,
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let suppressModelSync = false

const showToolbar = computed(() => props.showFormatButton && !props.readOnly)

function mapLanguage(language: ApiCodeLanguage) {
  return language === 'text' ? 'plaintext' : language
}

function ensureMonacoWorkers() {
  const globalWithMonaco = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_: string, label: string) => Worker
    }
  }

  globalWithMonaco.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }
      return new editorWorker()
    },
  }
}

async function formatDocument() {
  if (!editor) {
    return
  }
  await editor.getAction('editor.action.formatDocument')?.run()
}

function createEditor() {
  if (!containerRef.value) {
    return
  }

  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue ?? '',
    language: mapLanguage(props.language),
    theme: 'vs',
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    contextmenu: !props.readOnly,
    lineNumbersMinChars: 3,
    lineDecorationsWidth: 0,
    tabSize: 2,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    roundedSelection: false,
    renderLineHighlight: 'line',
    scrollbar: {
      alwaysConsumeMouseWheel: false,
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    padding: {
      top: 12,
      bottom: 12,
    },
    ariaLabel: props.placeholder || 'code editor',
  })
  editor.getModel()?.setEOL(monaco.editor.EndOfLineSequence.LF)
  editor.onDidChangeModelContent(() => {
    if (!editor || suppressModelSync) {
      return
    }
    const value = editor.getValue()
    emit('update:modelValue', value)
    emit('change', value)
  })
}

watch(
  () => props.modelValue,
  (value) => {
    const nextValue = value ?? ''
    if (!editor || editor.getValue() === nextValue) {
      return
    }
    suppressModelSync = true
    editor.setValue(nextValue)
    suppressModelSync = false
  },
)

watch(
  () => props.language,
  (language) => {
    const model = editor?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, mapLanguage(language))
    }
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editor?.updateOptions({
      readOnly,
      contextmenu: !readOnly,
    })
  },
)

onMounted(() => {
  ensureMonacoWorkers()
  createEditor()
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})
</script>

<style scoped>
.api-code-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.api-code-editor__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 0 0 8px;
  background: #fff;
}

.api-code-editor__format {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fff;
  color: #1d2129;
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;
}

.api-code-editor__format:hover {
  border-color: #c9cdd4;
  background: #f7f8fa;
  color: #165dff;
}

.api-code-editor__body {
  flex: 1 1 auto;
  min-height: 0;
}

.api-code-editor__body :deep(.monaco-editor),
.api-code-editor__body :deep(.overflow-guard) {
  border-radius: 0;
}
</style>
