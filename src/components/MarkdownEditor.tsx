import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { cn } from '../utils';
import { VariableDecorations } from './tiptapVariableDecorations';

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  showSource: boolean;
  onToggleSource: () => void;
  showHeader?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function MarkdownEditor({
  value,
  onChange,
  showSource,
  onToggleSource,
  showHeader = true,
  className,
  placeholder,
  disabled
}: MarkdownEditorProps) {
  const updatingRef = useRef(false);
  const [sourceValue, setSourceValue] = useState(value ?? '');

  const extensions = useMemo(
    () => [
      StarterKit,
      Link.configure({ openOnClick: false }),
      VariableDecorations,
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: false
      })
    ],
    []
  );

  const editor = useEditor(
    {
      extensions,
      content: value ?? '',
      editable: !disabled,
      editorProps: {
        attributes: {
          class:
            'md-editor-content focus:outline-none min-h-[260px] px-4 py-3 text-sm leading-relaxed text-slate-900 dark:text-slate-100'
        }
      },
      onUpdate: ({ editor }) => {
        if (updatingRef.current) return;
        const next = editor.storage.markdown.getMarkdown();
        onChange(next);
      }
    },
    []
  );

  useEffect(() => {
    if (showSource) {
      setSourceValue(value ?? '');
      return;
    }
    if (!editor) return;
    const current = editor.storage.markdown.getMarkdown();
    if ((value ?? '') === current) return;
    updatingRef.current = true;
    editor.commands.setContent(value ?? '');
    updatingRef.current = false;
  }, [editor, showSource, value]);

  return (
    <div className={cn('w-full rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden', className)}>
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {showSource ? 'Markdown 源代码' : '预览'}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!showSource && editor) {
                setSourceValue(editor.storage.markdown.getMarkdown());
              }
              onToggleSource();
              if (showSource && editor) {
                updatingRef.current = true;
                editor.commands.setContent(sourceValue);
                updatingRef.current = false;
              }
            }}
            className="text-xs px-2 py-1 rounded-md bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {showSource ? '显示预览' : '显示源代码'}
          </button>
        </div>
      )}

      {showSource ? (
        <textarea
          value={sourceValue}
          onChange={(e) => {
            const next = e.target.value;
            setSourceValue(next);
            onChange(next);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full min-h-[260px] p-4 bg-white dark:bg-slate-900 font-mono text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none beautify-scrollbar"
        />
      ) : (
        <div className={cn(disabled && 'opacity-60 pointer-events-none')}>
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
