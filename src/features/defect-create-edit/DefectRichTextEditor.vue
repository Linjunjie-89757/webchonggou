<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue'
import type { Component } from 'vue'
import { RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent, NodeViewWrapper, VueNodeViewRenderer, useEditor } from '@tiptap/vue-3'
import type { NodeViewProps } from '@tiptap/vue-3'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    defectImage: {
      insertDefectImage: (options: { src: string; alt?: string }) => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => (attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

const DefectImageNodeView = defineComponent({
  name: 'DefectImageNodeView',
  props: {
    node: {
      type: Object,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    deleteNode: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const imageSrc = computed(() => String((props.node as { attrs?: Record<string, unknown> }).attrs?.src ?? ''))
    const imageAlt = computed(() => String((props.node as { attrs?: Record<string, unknown> }).attrs?.alt ?? '缺陷图片'))

    function stopEvent(event: Event) {
      event.preventDefault()
      event.stopPropagation()
    }

    function openPreview(event: Event) {
      stopEvent(event)
      window.open(imageSrc.value, '_blank', 'noopener,noreferrer')
    }

    function removeImage(event: Event) {
      stopEvent(event)
      props.deleteNode()
    }

    return () => h(NodeViewWrapper, {
      class: ['defect-rich-image-node', { 'is-selected': props.selected }],
      'data-drag-handle': '',
    }, () => [
      h('div', {
        class: 'defect-rich-image-tools',
        contenteditable: 'false',
      }, [
        h('button', {
          type: 'button',
          title: '预览图片',
          onMousedown: stopEvent,
          onClick: openPreview,
        }, '预览'),
        h('button', {
          type: 'button',
          title: '删除图片',
          onMousedown: stopEvent,
          onClick: removeImage,
        }, '删除'),
      ]),
      h('img', {
        src: imageSrc.value,
        alt: imageAlt.value,
        draggable: 'true',
      }),
    ])
  },
})

const DefectImage = Node.create({
  name: 'defectImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
  addNodeView() {
    return VueNodeViewRenderer(DefectImageNodeView as Component<NodeViewProps>)
  },
  addCommands() {
    return {
      insertDefectImage: options => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: options,
      }),
    }
  },
})

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  addInlineImage: [payload: { file: File; src: string }]
}>()

const inlineImageInput = ref<HTMLInputElement | null>(null)

const headingOptions = [
  { label: '正文', value: 'paragraph' },
  { label: 'H1', value: 'h1' },
  { label: 'H2', value: 'h2' },
  { label: 'H3', value: 'h3' },
  { label: 'H4', value: 'h4' },
  { label: 'H5', value: 'h5' },
  { label: 'H6', value: 'h6' },
]

const fontSizeOptions = [
  { label: '默认', value: 'default' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
]

const toolbarTooltipProps = {
  showAfter: 200,
  hideAfter: 0,
  enterable: false,
}

let syncingFromEditor = false
let syncingFromModel = false

const editor = useEditor({
  content: normalizeEditorContent(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      underline: false,
    }),
    TextStyle,
    FontSize,
    Underline,
    Highlight,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TaskList,
    TaskItem.configure({
      nested: false,
    }),
    DefectImage,
    Placeholder.configure({
      placeholder: '请输入缺陷描述',
    }),
  ],
  editable: !props.disabled,
  editorProps: {
    attributes: {
      class: 'defect-rich-text-editor__input',
    },
    handlePaste(view, event) {
      const files = Array.from(event.clipboardData?.files ?? [])
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      if (imageFiles.length) {
        event.preventDefault()
        imageFiles.forEach(insertInlineImageFile)
        return true
      }

      const text = event.clipboardData?.getData('text/plain')
      if (!text) {
        return false
      }

      event.preventDefault()
      view.dispatch(view.state.tr.insertText(text))
      return true
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    syncingFromEditor = true
    emit('update:modelValue', currentEditor.getHTML())
    queueMicrotask(() => {
      syncingFromEditor = false
    })
  },
})

const currentHeadingLabel = computed(() => {
  if (!editor.value) {
    return '正文'
  }
  const matched = headingOptions.find((item) => {
    if (item.value === 'paragraph') {
      return editor.value?.isActive('paragraph')
    }
    const level = Number(item.value.replace('h', ''))
    return editor.value?.isActive('heading', { level })
  })
  return matched?.label ?? '正文'
})

const currentFontSizeLabel = computed(() => {
  const size = editor.value?.getAttributes('textStyle').fontSize as string | undefined
  return fontSizeOptions.find(item => item.value === size)?.label ?? '默认'
})

watch(
  () => props.modelValue,
  () => {
    if (!syncingFromEditor) {
      syncEditorFromModel()
    }
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled)
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function normalizeEditorContent(content: string) {
  const normalizedText = content.replace(/\r\n/g, '\n')
  const trimmed = normalizedText.trim()
  if (!trimmed) {
    return '<p></p>'
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed
  }
  return normalizedText
    .split('\n')
    .map(line => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function syncEditorFromModel() {
  if (!editor.value || syncingFromModel) {
    return
  }
  const normalized = normalizeEditorContent(props.modelValue)
  if (editor.value.getHTML() === normalized) {
    return
  }
  syncingFromModel = true
  editor.value.commands.setContent(normalized, { emitUpdate: false })
  queueMicrotask(() => {
    syncingFromModel = false
  })
}

function chain(editorInstance?: Editor | null) {
  return editorInstance?.chain().focus()
}

function applyHeading(value: string | number | object) {
  if (!editor.value) {
    return
  }
  if (value === 'paragraph') {
    chain(editor.value)?.setParagraph().run()
    return
  }
  const level = Number(String(value).replace('h', ''))
  chain(editor.value)?.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run()
}

function applyFontSize(value: string | number | object) {
  if (!editor.value) {
    return
  }
  if (value === 'default') {
    editor.value.commands.unsetFontSize()
    return
  }
  editor.value.chain().focus().setFontSize(String(value)).run()
}

function clearFormatting() {
  editor.value?.chain().focus().unsetAllMarks().clearNodes().run()
}

function clearContent() {
  editor.value?.commands.clearContent()
  emit('update:modelValue', '')
}

function openInlineImagePicker() {
  inlineImageInput.value?.click()
}

function insertInlineImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return
  }
  const src = URL.createObjectURL(file)
  chain(editor.value)?.insertDefectImage({ src, alt: file.name }).run()
  emit('addInlineImage', { file, src })
}

function handleInlineImageChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  files.forEach(insertInlineImageFile)
  if (input) {
    input.value = ''
  }
}
</script>

<template>
  <div class="defect-rich-text-editor" :class="{ 'is-disabled': disabled }">
    <div class="defect-rich-text-editor__toolbar">
      <div class="defect-rich-text-editor__group">
        <el-tooltip v-bind="toolbarTooltipProps" content="撤销" placement="top">
          <el-button text class="defect-rich-text-editor__button" :disabled="disabled || !editor?.can().undo()" @click="chain(editor)?.undo().run()">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="恢复" placement="top">
          <el-button text class="defect-rich-text-editor__button" :disabled="disabled || !editor?.can().redo()" @click="chain(editor)?.redo().run()">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <span class="defect-rich-text-editor__divider" />

      <div class="defect-rich-text-editor__group">
        <el-dropdown trigger="click" :disabled="disabled" @command="applyHeading">
          <el-button text class="defect-rich-text-editor__select">
            <span>{{ currentHeadingLabel }}</span>
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__caret">
              <path d="m5.5 7.5 4.5 5 4.5-5" />
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="item in headingOptions" :key="item.value" :command="item.value">
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="click" :disabled="disabled" @command="applyFontSize">
          <el-button text class="defect-rich-text-editor__select is-size">
            <span>{{ currentFontSizeLabel }}</span>
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__caret">
              <path d="m5.5 7.5 4.5 5 4.5-5" />
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="item in fontSizeOptions" :key="item.value" :command="item.value">
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <span class="defect-rich-text-editor__divider" />

      <div class="defect-rich-text-editor__group">
        <el-tooltip v-bind="toolbarTooltipProps" content="加粗" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('bold') }" :disabled="disabled" @click="chain(editor)?.toggleBold().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M6 4.5h4.3c1.9 0 3.1.9 3.1 2.4 0 1-.5 1.8-1.5 2.1 1.2.3 2 1.2 2 2.5 0 1.8-1.4 3-3.6 3H6zM8.2 8.3h1.7c.8 0 1.2-.3 1.2-.9s-.4-.9-1.2-.9H8.2zm0 4.2h2c.9 0 1.4-.4 1.4-1.1s-.5-1.1-1.4-1.1h-2z" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="斜体" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('italic') }" :disabled="disabled" @click="chain(editor)?.toggleItalic().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M9 4.5h6M5 15.5h6M11.5 4.5l-3 11" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="下划线" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('underline') }" :disabled="disabled" @click="chain(editor)?.toggleUnderline().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M6 4.5v5a4 4 0 0 0 8 0v-5M5 16h10" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="删除线" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('strike') }" :disabled="disabled" @click="chain(editor)?.toggleStrike().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M5 10h10M13.2 6.2A4.8 4.8 0 0 0 10 5c-1.8 0-3 .8-3 2 0 2.8 6 1.3 6 5 0 1.2-1.1 2-3 2a5.6 5.6 0 0 1-3.7-1.3" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="高亮" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('highlight') }" :disabled="disabled" @click="chain(editor)?.toggleHighlight().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="m5.5 12 6.8-6.8 2.5 2.5L8 14.5H5.5zM4.5 16h11" />
            </svg>
          </el-button>
        </el-tooltip>
      </div>

      <span class="defect-rich-text-editor__divider" />

      <div class="defect-rich-text-editor__group">
        <el-tooltip v-bind="toolbarTooltipProps" content="无序列表" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('bulletList') }" :disabled="disabled" @click="chain(editor)?.toggleBulletList().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M5.5 7h.01M5.5 13h.01M8.5 7h7M8.5 13h7" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="有序列表" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('orderedList') }" :disabled="disabled" @click="chain(editor)?.toggleOrderedList().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4.5 6h1.5v4M4.2 14.5c.5-.8 1.2-1.3 2-1.3.9 0 1.5.5 1.5 1.2 0 .5-.3.9-.8 1.4l-1.6 1.4h2.6M10 6h6M10 10h6M10 14h6" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="任务列表" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive('taskList') }" :disabled="disabled" @click="chain(editor)?.toggleTaskList().run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4.5 5.5h3v3h-3zM5.2 7l.8.8 1.4-1.8M10 7h6M4.5 11.5h3v3h-3zM5.2 13l.8.8 1.4-1.8M10 13h6" />
            </svg>
          </el-button>
        </el-tooltip>
      </div>

      <span class="defect-rich-text-editor__divider" />

      <div class="defect-rich-text-editor__group">
        <el-tooltip v-bind="toolbarTooltipProps" content="左对齐" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive({ textAlign: 'left' }) }" :disabled="disabled" @click="chain(editor)?.setTextAlign('left').run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4 5.5h11M4 9h8M4 12.5h11M4 16h7" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="居中" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }" :disabled="disabled" @click="chain(editor)?.setTextAlign('center').run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4.5 5.5h11M6 9h8M4.5 12.5h11M6.5 16h7" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="右对齐" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive({ textAlign: 'right' }) }" :disabled="disabled" @click="chain(editor)?.setTextAlign('right').run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M5 5.5h11M8 9h8M5 12.5h11M9 16h7" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="两端对齐" placement="top">
          <el-button text class="defect-rich-text-editor__button" :class="{ 'is-active': editor?.isActive({ textAlign: 'justify' }) }" :disabled="disabled" @click="chain(editor)?.setTextAlign('justify').run()">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4 5.5h12M4 9h12M4 12.5h12M4 16h12" />
            </svg>
          </el-button>
        </el-tooltip>
      </div>

      <span class="defect-rich-text-editor__divider" />

      <div class="defect-rich-text-editor__group">
        <el-tooltip v-bind="toolbarTooltipProps" content="插入图片" placement="top">
          <el-button text class="defect-rich-text-editor__button" :disabled="disabled" @click="openInlineImagePicker">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4.5 5.5h11v9h-11zM7 12l2.1-2.2 1.8 1.9 1.1-1.2 2.5 2.5M7.2 7.5h.01" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="清除格式" placement="top">
          <el-button text class="defect-rich-text-editor__button" :disabled="disabled" @click="clearFormatting">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M4.5 5.5h8M8.5 5.5v9M6.5 15.5h4M11.5 6.5l4 4M15.5 6.5l-4 4" />
            </svg>
          </el-button>
        </el-tooltip>
        <el-tooltip v-bind="toolbarTooltipProps" content="清空内容" placement="top">
          <el-button text class="defect-rich-text-editor__button" :disabled="disabled" @click="clearContent">
            <svg viewBox="0 0 20 20" class="defect-rich-text-editor__svg">
              <path d="M6 6h8M7 6V4.8h6V6M7 8v6.5M10 8v6.5M13 8v6.5M5.5 6l.7 10h7.6l.7-10" />
            </svg>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <EditorContent :editor="editor" class="defect-rich-text-editor__content" />
    <input ref="inlineImageInput" class="defect-rich-text-editor__file" type="file" accept="image/*" @change="handleInlineImageChange">
  </div>
</template>

<style scoped>
.defect-rich-text-editor {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.defect-rich-text-editor.is-disabled {
  opacity: 0.7;
}

.defect-rich-text-editor__toolbar {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 1px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 5px 6px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  scrollbar-width: thin;
}

.defect-rich-text-editor__group {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
}

.defect-rich-text-editor__divider {
  width: 1px;
  height: 16px;
  flex: 0 0 auto;
  margin: 0 3px;
  background: var(--app-border);
}

.defect-rich-text-editor__button,
.defect-rich-text-editor__select {
  height: 30px;
  margin: 0;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.defect-rich-text-editor__button {
  width: 30px;
  padding: 0;
}

.defect-rich-text-editor__select {
  min-width: 52px;
  padding: 0 6px;
}

.defect-rich-text-editor__select.is-size {
  min-width: 58px;
}

.defect-rich-text-editor__button:hover,
.defect-rich-text-editor__select:hover,
.defect-rich-text-editor__button.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-rich-text-editor__caret {
  width: 14px;
  height: 14px;
  margin-left: 3px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.defect-rich-text-editor__svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.defect-rich-text-editor__content {
  min-height: 336px;
  padding: 14px 16px;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input) {
  min-height: 308px;
  outline: none;
  color: var(--app-text-primary);
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input p) {
  margin: 0 0 12px;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input p:last-child) {
  margin-bottom: 0;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h1),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h2),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h3),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h4),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h5),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input h6) {
  margin: 0 0 8px;
  line-height: 1.45;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ul),
.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ol) {
  margin: 0 0 10px;
  padding-left: 22px;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input mark) {
  padding: 0 2px;
  background: #fff3bf;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ul[data-type="taskList"] li > label) {
  margin-top: 3px;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input ul[data-type="taskList"] li > div) {
  flex: 1;
}

.defect-rich-text-editor__content :deep(.defect-rich-text-editor__input p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--app-text-subtle);
  pointer-events: none;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-node) {
  position: relative;
  width: 100%;
  max-width: 100%;
  margin: 10px 0 14px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  line-height: 0;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-node.is-selected) {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
}

.defect-rich-text-editor__content :deep(.defect-rich-image-node img) {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  object-fit: contain;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-tools) {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-node:hover .defect-rich-image-tools),
.defect-rich-text-editor__content :deep(.defect-rich-image-node.is-selected .defect-rich-image-tools) {
  opacity: 1;
  pointer-events: auto;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-tools button) {
  height: 26px;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: var(--app-radius-sm);
  background: rgba(255, 255, 255, 0.92);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 24px;
}

.defect-rich-text-editor__content :deep(.defect-rich-image-tools button:hover) {
  color: var(--app-primary);
}

.defect-rich-text-editor__file {
  display: none;
}
</style>
