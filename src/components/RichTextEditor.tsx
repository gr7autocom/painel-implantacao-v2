import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import FontFamily from '@tiptap/extension-font-family'
import Image from '@tiptap/extension-image'
import { uploadImagemCloudinary } from '../lib/cloudinary'
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
}

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
]

const HEADING_LEVELS = [
  { label: 'Parágrafo', level: 0 },
  { label: 'Título 1', level: 1 },
  { label: 'Título 2', level: 2 },
  { label: 'Título 3', level: 3 },
  { label: 'Título 4', level: 4 },
] as const

type Level = 1 | 2 | 3 | 4

export function RichTextEditor({ value, onChange, disabled, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escreva aqui…',
      }),
    ],
    content: DOMPurify.sanitize(value ?? ''),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageItem = items.find((i) => i.type.startsWith('image/'))
        if (!imageItem) return false
        event.preventDefault()
        const file = imageItem.getAsFile()
        if (!file) return false
        uploadImagemCloudinary(file).then(({ url }) => {
          view.dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src: url })
            )
          )
        }).catch(() => {})
        return true
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(DOMPurify.sanitize(value ?? ''), { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  const containerClass = disabled
    ? 'border border-gray-200 bg-gray-50 rounded-lg'
    : 'border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500'

  return (
    <div className={containerClass}>
      {!disabled && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="rich-text-content px-3 py-2 min-h-[160px] max-h-[50vh] overflow-y-auto text-sm text-gray-800"
      />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const highlightInputRef = useRef<HTMLInputElement>(null)

  const currentHeading = [1, 2, 3, 4].find((l) =>
    editor.isActive('heading', { level: l })
  ) as Level | undefined
  const currentFont =
    FONT_FAMILIES.find((f) => editor.isActive('textStyle', { fontFamily: f.value }))?.value ?? ''

  function handleHeadingChange(level: number) {
    const chain = editor.chain().focus()
    if (level === 0) chain.setParagraph().run()
    else chain.toggleHeading({ level: level as Level }).run()
  }

  function handleFontChange(family: string) {
    if (!family) editor.chain().focus().unsetFontFamily().run()
    else editor.chain().focus().setFontFamily(family).run()
  }

  function applyColor(e: React.ChangeEvent<HTMLInputElement>) {
    editor.chain().focus().setColor(e.target.value).run()
  }

  function applyHighlight(e: React.ChangeEvent<HTMLInputElement>) {
    editor.chain().focus().setHighlight({ color: e.target.value }).run()
  }

  function handleLink() {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL do link:', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      <select
        value={currentFont}
        onChange={(e) => handleFontChange(e.target.value)}
        className="text-xs bg-white border border-gray-200 rounded px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        title="Família da fonte"
      >
        <option value="">Sans Serif</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={currentHeading ?? 0}
        onChange={(e) => handleHeadingChange(Number(e.target.value))}
        className="text-xs bg-white border border-gray-200 rounded px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        title="Estilo do parágrafo"
      >
        {HEADING_LEVELS.map((h) => (
          <option key={h.level} value={h.level}>
            {h.label}
          </option>
        ))}
      </select>

      <Divider />

      <BotaoToolbar
        title="Negrito"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-3.5 h-3.5" />
      </BotaoToolbar>
      <BotaoToolbar
        title="Itálico"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-3.5 h-3.5" />
      </BotaoToolbar>
      <BotaoToolbar
        title="Sublinhado"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </BotaoToolbar>
      <BotaoToolbar
        title="Tachado"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </BotaoToolbar>
      <BotaoToolbar
        title="Código"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="w-3.5 h-3.5" />
      </BotaoToolbar>

      <Divider />

      <BotaoToolbar title="Cor do texto" onClick={() => colorInputRef.current?.click()}>
        <Palette className="w-3.5 h-3.5" />
        <input
          ref={colorInputRef}
          type="color"
          onChange={applyColor}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
        />
      </BotaoToolbar>
      <BotaoToolbar title="Cor de fundo" onClick={() => highlightInputRef.current?.click()}>
        <Highlighter className="w-3.5 h-3.5" />
        <input
          ref={highlightInputRef}
          type="color"
          onChange={applyHighlight}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
        />
      </BotaoToolbar>

      <Divider />

      <BotaoToolbar
        title="Lista"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="w-3.5 h-3.5" />
      </BotaoToolbar>
      <BotaoToolbar
        title="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </BotaoToolbar>

      <Divider />

      <BotaoToolbar
        title="Link"
        active={editor.isActive('link')}
        onClick={handleLink}
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </BotaoToolbar>
    </div>
  )
}

function BotaoToolbar({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center w-7 h-7 rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-gray-300" />
}
