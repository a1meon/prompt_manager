import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Copy, 
  Check, 
  Save, 
  X, 
  Minus,
  Maximize2,
  Minimize2,
  AlertCircle,
  FileText,
  Layers,
  Settings2,
  PlusCircle,
  RefreshCw,
  Info,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { Template, ActiveTab, TemplateGroup, SidebarOrderItem } from './types';
import { DEFAULT_TEMPLATES, STORAGE_KEY, TEMPLATE_VARIABLES_STORAGE_KEY, THEME_STORAGE_KEY } from './constants';
import { cn, extractVariables, generatePrompt, copyToClipboard, markdownToPlainText } from './utils';
import { Sidebar } from './components/Sidebar';
import { EmptyState } from './components/EmptyState';
import { VariablesForm } from './components/VariablesForm';
import { MarkdownEditor } from './components/MarkdownEditor';
import { MarkdownViewer } from './components/MarkdownViewer';

const VARIABLE_TOKEN_REGEX = /\{([^{}]+)\}/g;
const VARIABLE_COLOR_COUNT = 8;

function hashToIndex(input: string, modulo: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : hash % modulo;
}

function renderWithVariableHighlights(text: string) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  VARIABLE_TOKEN_REGEX.lastIndex = 0;
  while ((match = VARIABLE_TOKEN_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const tokenContent = match[1] ?? '';
    const start = match.index;
    const end = start + fullMatch.length;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const normalized = tokenContent.trim().toLowerCase();
    const colorIndex = hashToIndex(normalized, VARIABLE_COLOR_COUNT);
    parts.push(
      <span key={`${start}-${end}`} className={cn('var-token', `var-token-${colorIndex}`)}>
        {fullMatch}
      </span>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHighlightedHtml(text: string) {
  if (!text) return '';
  const pieces: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  VARIABLE_TOKEN_REGEX.lastIndex = 0;
  while ((match = VARIABLE_TOKEN_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const tokenContent = match[1] ?? '';
    const start = match.index;
    const end = start + fullMatch.length;

    if (start > lastIndex) {
      pieces.push(escapeHtml(text.slice(lastIndex, start)));
    }

    const normalized = tokenContent.trim().toLowerCase();
    const colorIndex = hashToIndex(normalized, VARIABLE_COLOR_COUNT);
    pieces.push(
      `<span class="var-token var-token-${colorIndex}">${escapeHtml(fullMatch)}</span>`
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    pieces.push(escapeHtml(text.slice(lastIndex)));
  }

  return pieces.join('');
}

function getSelectionOffsetsWithin(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { start: 0, end: 0 };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }

  const preRangeStart = document.createRange();
  preRangeStart.selectNodeContents(root);
  preRangeStart.setEnd(range.startContainer, range.startOffset);
  const start = preRangeStart.toString().length;

  const preRangeEnd = document.createRange();
  preRangeEnd.selectNodeContents(root);
  preRangeEnd.setEnd(range.endContainer, range.endOffset);
  const end = preRangeEnd.toString().length;

  return { start, end };
}

function setSelectionOffsetsWithin(root: HTMLElement, start: number, end: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null = walker.nextNode();
  let currentIndex = 0;

  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  while (currentNode) {
    const text = currentNode.textContent ?? '';
    const nextIndex = currentIndex + text.length;

    if (!startNode && start >= currentIndex && start <= nextIndex) {
      startNode = currentNode;
      startOffset = start - currentIndex;
    }

    if (!endNode && end >= currentIndex && end <= nextIndex) {
      endNode = currentNode;
      endOffset = end - currentIndex;
    }

    if (startNode && endNode) break;

    currentIndex = nextIndex;
    currentNode = walker.nextNode();
  }

  if (!startNode || !endNode) {
    root.focus();
    return;
  }

  const range = document.createRange();
  range.setStart(startNode, Math.max(0, Math.min(startOffset, (startNode.textContent ?? '').length)));
  range.setEnd(endNode, Math.max(0, Math.min(endOffset, (endNode.textContent ?? '').length)));
  selection.removeAllRanges();
  selection.addRange(range);
}

type VariableEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function VariableEditor({ value, onChange, placeholder, className, disabled }: VariableEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const composingRef = useRef(false);
  const applyingRef = useRef(false);

  const syncDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const currentText = el.innerText.replace(/\r/g, '');
    const nextText = (value ?? '').replace(/\r/g, '');
    if (currentText === nextText) return;
    const offsets = pendingSelectionRef.current ?? getSelectionOffsetsWithin(el);
    pendingSelectionRef.current = offsets;
    el.innerHTML = buildHighlightedHtml(nextText);
  }, [value]);

  useLayoutEffect(() => {
    if (composingRef.current) return;
    syncDom();
    const el = editorRef.current;
    const pending = pendingSelectionRef.current;
    if (!el || !pending) return;
    pendingSelectionRef.current = null;
    setSelectionOffsetsWithin(el, pending.start, pending.end);
  }, [syncDom, value]);

  const applyTab = useCallback((start: number, end: number, isShift: boolean) => {
    const tabText = '\t';
    const text = value ?? '';
    const selectionStartLineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;

    const lineStarts: number[] = [selectionStartLineStart];
    let scan = selectionStartLineStart;
    while (scan < end) {
      const nl = text.indexOf('\n', scan);
      if (nl === -1 || nl >= end) break;
      scan = nl + 1;
      if (scan < end) lineStarts.push(scan);
    }

    if (!isShift) {
      if (start === end) {
        const next = text.slice(0, start) + tabText + text.slice(end);
        onChange(next);
        pendingSelectionRef.current = { start: start + tabText.length, end: start + tabText.length };
        return;
      }

      let next = text;
      for (let i = lineStarts.length - 1; i >= 0; i--) {
        const pos = lineStarts[i]!;
        next = next.slice(0, pos) + tabText + next.slice(pos);
      }
      onChange(next);
      pendingSelectionRef.current = {
        start: start + tabText.length,
        end: end + tabText.length * lineStarts.length
      };
      return;
    }

    let next = text;
    let removedBeforeStart = 0;
    let removedBeforeEnd = 0;

    for (let i = lineStarts.length - 1; i >= 0; i--) {
      const pos = lineStarts[i]!;
      const c1 = next.charAt(pos);
      const c2 = next.slice(pos, pos + 2);
      let removeLen = 0;

      if (c1 === '\t') removeLen = 1;
      else if (c2 === '  ') removeLen = 2;

      if (removeLen === 0) continue;

      next = next.slice(0, pos) + next.slice(pos + removeLen);
      if (pos < start) removedBeforeStart += removeLen;
      if (pos < end) removedBeforeEnd += removeLen;
    }

    onChange(next);
    const nextStart = Math.max(0, start - removedBeforeStart);
    const nextEnd = Math.max(0, end - removedBeforeEnd);
    pendingSelectionRef.current = { start: nextStart, end: nextEnd };
  }, [onChange, value]);

  return (
    <div
      className={cn(
        "relative w-full h-64 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all overflow-hidden",
        className
      )}
    >
      <div
        ref={editorRef}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || ''}
        className="variable-editor beautify-scrollbar h-full overflow-auto pl-4 pr-6 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          const el = editorRef.current;
          if (!el) return;
          const { start, end } = getSelectionOffsetsWithin(el);
          applyTab(start, end, e.shiftKey);
        }}
        onBeforeInput={() => {
          const el = editorRef.current;
          if (!el) return;
          pendingSelectionRef.current = getSelectionOffsetsWithin(el);
        }}
        onInput={() => {
          const el = editorRef.current;
          if (!el || composingRef.current) return;
          if (applyingRef.current) {
            applyingRef.current = false;
            return;
          }
          const next = el.innerText.replace(/\r/g, '');
          const offsets = getSelectionOffsetsWithin(el);
          pendingSelectionRef.current = offsets;
          applyingRef.current = true;
          el.innerHTML = buildHighlightedHtml(next);
          setSelectionOffsetsWithin(el, offsets.start, offsets.end);
          onChange(next);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          const el = editorRef.current;
          if (!el) return;
          const next = el.innerText.replace(/\r/g, '');
          const offsets = getSelectionOffsetsWithin(el);
          pendingSelectionRef.current = offsets;
          applyingRef.current = true;
          el.innerHTML = buildHighlightedHtml(next);
          setSelectionOffsetsWithin(el, offsets.start, offsets.end);
          onChange(next);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          range.deleteContents();

          const parts = text.replace(/\r/g, '').split('\n');
          const fragment = document.createDocumentFragment();
          parts.forEach((part, idx) => {
            fragment.appendChild(document.createTextNode(part));
            if (idx < parts.length - 1) fragment.appendChild(document.createElement('br'));
          });
          range.insertNode(fragment);
          selection.collapseToEnd();

          const el = editorRef.current;
          if (!el || composingRef.current) return;
          const next = el.innerText.replace(/\r/g, '');
          pendingSelectionRef.current = getSelectionOffsetsWithin(el);
          onChange(next);
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}

export default function App() {
  // --- State ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([]);
  const [sidebarOrder, setSidebarOrder] = useState<SidebarOrderItem[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string>('');
  const [variablesByTemplateId, setVariablesByTemplateId] = useState<Record<string, Record<string, string>>>({});
  const [batchInput, setBatchInput] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('single');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [previewRawId, setPreviewRawId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [editorShowSource, setEditorShowSource] = useState(false);
  const [previewShowSource, setPreviewShowSource] = useState(false);
  const [rawPreviewShowSource, setRawPreviewShowSource] = useState(false);
  const [importHintPinned, setImportHintPinned] = useState(false);
  const [importHintHover, setImportHintHover] = useState(false);
  const [editorGroupPickerOpen, setEditorGroupPickerOpen] = useState(false);
  const [editorCreateGroupOpen, setEditorCreateGroupOpen] = useState(false);
  const [editorCreateGroupName, setEditorCreateGroupName] = useState('');
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateState, setUpdateState] = useState<
    | { step: 'idle' }
    | { step: 'checking' }
    | { step: 'none'; currentVersion: string }
    | { step: 'available'; currentVersion: string; latestVersion: string; releaseUrl?: string }
    | { step: 'downloading'; latestVersion: string }
    | { step: 'downloaded'; latestVersion: string }
    | { step: 'error'; message: string }
  >({ step: 'idle' });

  const helpMenuRef = useRef<HTMLDivElement | null>(null);
  const editorGroupPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const api = window.appWindow;
    if (!api) return;
    Promise.resolve(api.isMaximized()).then((value) => setIsMaximized(Boolean(value)));
    const off = api.onMaximizedChanged((value) => setIsMaximized(Boolean(value)));
    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  const activeVariables = useMemo(
    () => variablesByTemplateId[activeTemplateId] || {},
    [variablesByTemplateId, activeTemplateId]
  );

  // --- Theme Initialization ---
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      // 默认使用浅色主题
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const createGroupWithName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setTemplateGroups(prev => [{ id, name: trimmed, templateIds: [], collapsed: false }, ...prev]);
    setSidebarOrder(prev => [{ type: 'group' as const, id }, ...prev]);
    return id;
  }, []);

  useEffect(() => {
    if (isEditing) return;
    setEditorGroupPickerOpen(false);
    setEditorCreateGroupOpen(false);
    setEditorCreateGroupName('');
  }, [isEditing]);

  const compareSemver = useCallback((a: string, b: string) => {
    const pa = String(a).replace(/^v/i, '').split('.').map(n => Number(n || 0));
    const pb = String(b).replace(/^v/i, '').split('.').map(n => Number(n || 0));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }, []);

  const checkForUpdates = useCallback(async () => {
    setUpdateOpen(true);
    setUpdateState({ step: 'checking' });

    const currentVersion = __APP_VERSION__;

    if (window.appUpdate?.checkForUpdates) {
      const result: any = await Promise.resolve(window.appUpdate.checkForUpdates()).catch((err: any) => ({
        status: 'error',
        message: String(err?.message || err || '')
      }));
      if (result.status === 'no_update') {
        setUpdateState({ step: 'none', currentVersion });
        return;
      }
      if (result.status === 'update_available') {
        const latest = String(result.version || '');
        if (compareSemver(latest, currentVersion) <= 0) {
          setUpdateState({ step: 'none', currentVersion });
          return;
        }
        setUpdateState({
          step: 'available',
          currentVersion,
          latestVersion: latest
        });
        return;
      }
      setUpdateState({ step: 'error', message: String(result?.message || '检查更新失败') });
      return;
    }

    try {
      const res = await fetch('https://api.github.com/repos/a1meon/prompt_manager_release/releases/latest');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tag = String(data?.tag_name || '').replace(/^v/i, '');
      const url = String(data?.html_url || '');
      if (!tag) throw new Error('无法解析版本号');
      if (compareSemver(tag, currentVersion) <= 0) {
        setUpdateState({ step: 'none', currentVersion });
        return;
      }
      setUpdateState({ step: 'available', currentVersion, latestVersion: tag, releaseUrl: url });
    } catch (err) {
      setUpdateState({ step: 'error', message: String((err as any)?.message || err || '') });
    }
  }, [compareSemver]);

  const startDownloadAndInstall = useCallback(async () => {
    if (updateState.step !== 'available') return;
    if (window.appUpdate?.downloadUpdate) {
      setUpdateState({ step: 'downloading', latestVersion: updateState.latestVersion });
      const res: any = await Promise.resolve(window.appUpdate.downloadUpdate()).catch((err: any) => ({
        status: 'error',
        message: String(err?.message || err || '')
      }));
      if (res.status === 'downloaded') {
        setUpdateState({ step: 'downloaded', latestVersion: updateState.latestVersion });
        return;
      }
      setUpdateState({ step: 'error', message: String(res?.message || '下载更新失败') });
      return;
    }
    if (updateState.releaseUrl) {
      window.open(updateState.releaseUrl, '_blank', 'noopener,noreferrer');
    }
  }, [updateState]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (helpMenuOpen && helpMenuRef.current && target && helpMenuRef.current.contains(target)) return;
      if (editorGroupPickerOpen && editorGroupPickerRef.current && target && editorGroupPickerRef.current.contains(target)) return;
      setHelpMenuOpen(false);
      setEditorGroupPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setHelpMenuOpen(false);
      setEditorGroupPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [helpMenuOpen, editorGroupPickerOpen]);

  // --- Data Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
          setTemplateGroups([]);
          setSidebarOrder(parsed.map(t => ({ type: 'template', id: t.id })));
          if (parsed.length > 0) setActiveTemplateId(parsed[0].id);
          return;
        }
      } catch {
      }
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.templates)) {
          const nextTemplates: Template[] = parsed.templates;
          const nextGroups: TemplateGroup[] = Array.isArray(parsed.groups) ? parsed.groups : [];
          const rawOrder: SidebarOrderItem[] = Array.isArray(parsed.sidebarOrder) ? parsed.sidebarOrder : [];

          const templateIdSet = new Set(nextTemplates.map(t => t.id));
          const groupIdSet = new Set(nextGroups.map(g => g.id));

          const cleanedGroups = nextGroups
            .map(g => ({
              ...g,
              templateIds: Array.from(new Set((g.templateIds || []).filter(id => templateIdSet.has(id))))
            }))
            .filter(g => Boolean((g.name || '').trim()) && groupIdSet.has(g.id));

          const groupedTemplateIds = new Set(cleanedGroups.flatMap(g => g.templateIds));
          const cleanedOrder = rawOrder
            .filter(item => {
              if (!item || typeof item !== 'object') return false;
              if (item.type === 'template') return templateIdSet.has(item.id) && !groupedTemplateIds.has(item.id);
              if (item.type === 'group') return groupIdSet.has(item.id);
              return false;
            });

          const orderedTemplateIds = new Set(
            cleanedOrder.filter(i => i.type === 'template').map(i => i.id)
          );
          const missingRootTemplates = nextTemplates
            .map(t => t.id)
            .filter(id => !groupedTemplateIds.has(id) && !orderedTemplateIds.has(id))
            .map(id => ({ type: 'template' as const, id }));

          setTemplates(nextTemplates);
          setTemplateGroups(cleanedGroups);
          setSidebarOrder([...cleanedOrder, ...missingRootTemplates]);
          if (nextTemplates.length > 0) setActiveTemplateId(nextTemplates[0].id);
          return;
        }
      } catch {
      }
      localStorage.removeItem(STORAGE_KEY);
    } else {
      setTemplates(DEFAULT_TEMPLATES);
      setTemplateGroups([]);
      setSidebarOrder(DEFAULT_TEMPLATES.map(t => ({ type: 'template' as const, id: t.id })));
      setActiveTemplateId(DEFAULT_TEMPLATES[0].id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        templates,
        groups: templateGroups,
        sidebarOrder
      })
    );
  }, [templates, templateGroups, sidebarOrder]);

  useEffect(() => {
    if (templates.length === 0) {
      if (activeTemplateId) setActiveTemplateId('');
      return;
    }
    if (!templates.some(t => t.id === activeTemplateId)) {
      setActiveTemplateId(templates[0].id);
    }
  }, [templates, activeTemplateId]);

  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATE_VARIABLES_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        setVariablesByTemplateId(parsed);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_VARIABLES_STORAGE_KEY, JSON.stringify(variablesByTemplateId));
  }, [variablesByTemplateId]);

  const activeTemplate = useMemo(() => 
    templates.find(t => t.id === activeTemplateId) || null
  , [templates, activeTemplateId]);

  useEffect(() => {
    setPreviewShowSource(false);
  }, [activeTemplateId]);

  // --- Variable Extraction ---
  const extractedVariables = useMemo(() => {
    if (!activeTemplate) return [];
    return extractVariables(activeTemplate.content);
  }, [activeTemplate]);

  const orderedVariables = useMemo(() => {
    if (!activeTemplate) return [];
    const base = extractedVariables;
    const saved = activeTemplate.variableOrder || [];
    const set = new Set(base);
    const normalizedSaved = saved.filter(v => set.has(v));
    const missing = base.filter(v => !normalizedSaved.includes(v));
    return [...normalizedSaved, ...missing];
  }, [activeTemplate, extractedVariables]);

  useEffect(() => {
    if (!activeTemplate) return;
    const nextOrder = orderedVariables;
    const currentOrder = activeTemplate.variableOrder || [];
    const same =
      nextOrder.length === currentOrder.length &&
      nextOrder.every((v, i) => v === currentOrder[i]);
    if (same) return;
    setTemplates(prev =>
      prev.map(t => (t.id === activeTemplate.id ? { ...t, variableOrder: nextOrder } : t))
    );
  }, [activeTemplate, orderedVariables]);

  // --- Actions ---
  const handleAddTemplate = () => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: '未命名模板',
      description: '',
      content: ''
    };
    setImportHintPinned(false);
    setEditorShowSource(false);
    setEditingTemplate(newTemplate);
    setEditingGroupId('');
    setIsEditing(true);
  };

  const handleEditTemplate = (template: Template) => {
    setImportHintPinned(false);
    setEditorShowSource(false);
    setEditingTemplate({ ...template });
    const group = templateGroups.find(g => (g.templateIds || []).includes(template.id));
    setEditingGroupId(group?.id || '');
    setIsEditing(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    const targetGroupId = editingGroupId;
    const templateId = editingTemplate.id;
    if (templates.find(t => t.id === editingTemplate.id)) {
      setTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    } else {
      setTemplates([...templates, editingTemplate]);
      setActiveTemplateId(editingTemplate.id);
    }
    setTemplateGroups(prev => {
      const removed = prev.map(g => ({ ...g, templateIds: (g.templateIds || []).filter(tid => tid !== templateId) }));
      if (!targetGroupId) return removed;
      const idx = removed.findIndex(g => g.id === targetGroupId);
      if (idx < 0) return removed;
      const ids = [...(removed[idx].templateIds || [])];
      if (!ids.includes(templateId)) ids.push(templateId);
      return removed.map((g, i) => (i === idx ? { ...g, templateIds: ids } : g));
    });
    setSidebarOrder(prev => {
      const filtered = prev.filter(item => !(item.type === 'template' && item.id === templateId));
      if (targetGroupId) return filtered;
      return [...filtered, { type: 'template' as const, id: templateId }];
    });
    setIsEditing(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    const filtered = templates.filter(t => t.id !== id);
    setTemplates(filtered);
    setTemplateGroups(prev =>
      prev.map(g => ({ ...g, templateIds: g.templateIds.filter(tid => tid !== id) }))
    );
    setSidebarOrder(prev => prev.filter(item => !(item.type === 'template' && item.id === id)));
    if (activeTemplateId === id) {
      setActiveTemplateId(filtered[0]?.id || '');
    }
    setVariablesByTemplateId(prev => {
      if (!(id in prev)) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setShowDeleteConfirm(null);
  };

  const handleCopy = async (markdown: string, key: string = 'main') => {
    await copyToClipboard(markdownToPlainText(markdown));
    setCopyStatus(key);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleCopyMarkdown = async (markdown: string, key: string = 'main') => {
    await copyToClipboard(markdown);
    setCopyStatus(key);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const generatePromptWithTemplate = (vars: Record<string, string>) => {
    if (!activeTemplate) return '';
    return generatePrompt(activeTemplate.content, vars);
  };

  const singleResult = useMemo(() => {
    if (!activeTemplate) return { content: '', isComplete: true };
    if (orderedVariables.length === 0) {
      return { content: activeTemplate.content, isComplete: true };
    }
    const result = generatePrompt(activeTemplate.content, activeVariables);
    const missing = orderedVariables.some(v => !(activeVariables[v] || '').trim());
    return { 
      content: result, 
      isComplete: !missing 
    };
  }, [activeTemplate, activeVariables, orderedVariables]);

  const batchResults = useMemo(() => {
    if (!batchInput || !activeTemplate) return [];
    const lines = batchInput.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
      const values = line.split(/[,\t，]/).map(v => v.trim());
      const vars: Record<string, string> = {};
      
      const isValid = values.length === orderedVariables.length;
      
      orderedVariables.forEach((v, i) => {
        vars[v] = values[i] || '';
      });
      
      return {
        prompt: generatePrompt(activeTemplate.content, vars),
        isValid,
        lineContent: line
      };
    });
  }, [activeTemplate, batchInput, orderedVariables]);

  const batchCopyMarkdown = useMemo(() => {
    if (batchResults.length === 0) return '';
    return batchResults
      .map((res, idx) => {
        const header = `## ${idx + 1}`;
        const note = res.isValid ? '' : '\n\n> 注意：变量数量不匹配';
        return `${header}\n\n${res.prompt}${note}`;
      })
      .join('\n\n');
  }, [batchResults]);

  const handleExport = () => {
    const dataStr = JSON.stringify(
      {
        version: 2,
        templates,
        groups: templateGroups,
        sidebarOrder
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompt_templates_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const ensureUniqueId = (taken: Set<string>, base: string) => {
          let id = base;
          while (taken.has(id)) id = `${base}-${Math.random().toString(16).slice(2, 8)}`;
          taken.add(id);
          return id;
        };

        if (Array.isArray(parsed)) {
          setTemplates(prev => {
            const taken = new Set(prev.map(t => t.id));
            const next = parsed
              .filter(Boolean)
              .map((t: Template) => ({ ...t, id: ensureUniqueId(taken, String(t.id || Date.now())) }));
            setSidebarOrder(orderPrev => [
              ...orderPrev,
              ...next.map(t => ({ type: 'template' as const, id: t.id }))
            ]);
            return [...prev, ...next];
          });
          alert('导入成功！');
          return;
        }

        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.templates)) {
          setTemplates(prev => {
            const takenTemplateIds = new Set(prev.map(t => t.id));
            const takenGroupIds = new Set(templateGroups.map(g => g.id));

            const templateIdMap = new Map<string, string>();
            const importedTemplates: Template[] = parsed.templates
              .filter(Boolean)
              .map((t: Template) => {
                const oldId = String(t.id || Date.now());
                const newId = ensureUniqueId(takenTemplateIds, oldId);
                templateIdMap.set(oldId, newId);
                return { ...t, id: newId };
              });

            const importedGroups: TemplateGroup[] = Array.isArray(parsed.groups)
              ? parsed.groups
                  .filter(Boolean)
                  .map((g: TemplateGroup) => {
                    const oldId = String(g.id || Date.now());
                    const newId = ensureUniqueId(takenGroupIds, oldId);
                    return {
                      ...g,
                      id: newId,
                      templateIds: Array.from(
                        new Set((g.templateIds || []).map(tid => templateIdMap.get(String(tid)) || String(tid)))
                      ).filter(tid => importedTemplates.some(t => t.id === tid) || prev.some(t => t.id === tid))
                    };
                  })
              : [];

            const importedOrder: SidebarOrderItem[] = Array.isArray(parsed.sidebarOrder)
              ? parsed.sidebarOrder
                  .filter(Boolean)
                  .map((item: SidebarOrderItem) => {
                    if (item.type === 'template') {
                      const mapped = templateIdMap.get(String(item.id));
                      return { type: 'template' as const, id: mapped || String(item.id) };
                    }
                    return item;
                  })
              : importedGroups.map(g => ({ type: 'group' as const, id: g.id }));

            setTemplateGroups(groupPrev => [...groupPrev, ...importedGroups]);
            setSidebarOrder(orderPrev => {
              const existingGroupIds = new Set(orderPrev.filter(i => i.type === 'group').map(i => i.id));
              const next = importedOrder.filter(item => {
                if (item.type === 'template') return importedTemplates.some(t => t.id === item.id);
                return importedGroups.some(g => g.id === item.id) && !existingGroupIds.has(item.id);
              });
              const appendedTemplates = importedTemplates
                .map(t => t.id)
                .filter(id => !next.some(i => i.type === 'template' && i.id === id))
                .map(id => ({ type: 'template' as const, id }));
              const appendedGroups = importedGroups
                .map(g => g.id)
                .filter(id => !next.some(i => i.type === 'group' && i.id === id))
                .map(id => ({ type: 'group' as const, id }));
              return [...orderPrev, ...appendedGroups, ...next, ...appendedTemplates];
            });

            alert('导入成功！');
            return [...prev, ...importedTemplates];
          });
          return;
        }
      } catch (err) {
        alert('文件格式错误');
      }
    };
    reader.readAsText(file);
  };

  const importMarkdownAsTemplate = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? '');
      const baseName = (file.name || '未命名模板').replace(/\.(md|markdown)$/i, '');
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: baseName || '未命名模板',
        description: '',
        content: text
      };
      setTemplates(prev => [...prev, newTemplate]);
      setSidebarOrder(prev => [...prev, { type: 'template' as const, id: newTemplate.id }]);
      setActiveTemplateId(newTemplate.id);
      setPreviewShowSource(false);
      alert('导入成功！');
    };
    reader.readAsText(file);
  };

  const handleImportMd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importMarkdownAsTemplate(file);
    e.target.value = '';
  };

  const handleImportMdToEditor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? '');
      const baseName = (file.name || '').replace(/\.(md|markdown)$/i, '');
      setEditorShowSource(false);
      setEditingTemplate(prev => {
        if (!prev) return prev;
        const nextName = prev.name === '未命名模板' && baseName ? baseName : prev.name;
        return { ...prev, name: nextName, content: text };
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- UI Components ---
  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <div className="titlebar-drag h-12 flex items-center justify-between px-3 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/90 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]" />
            <span className="text-sm font-semibold tracking-tight truncate">一世提示词管理</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>

        <div className="titlebar-no-drag flex items-center">
          <div ref={helpMenuRef} className="relative mr-1">
            <button
              type="button"
              onClick={() => setHelpMenuOpen(v => !v)}
              className="h-9 px-3 flex items-center gap-2 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors text-sm"
              aria-haspopup="menu"
              aria-expanded={helpMenuOpen}
            >
              <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              帮助
            </button>
            {helpMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden z-50">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => {
                    setHelpMenuOpen(false);
                    checkForUpdates();
                  }}
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  检查更新
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => {
                    setHelpMenuOpen(false);
                    setAboutOpen(true);
                  }}
                >
                  <Info className="w-4 h-4 text-slate-500" />
                  关于
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => window.appWindow?.minimize?.()}
            className="h-9 w-10 flex items-center justify-center rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors"
            aria-label="最小化"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.appWindow?.toggleMaximize?.()}
            className="h-9 w-10 flex items-center justify-center rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors"
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => window.appWindow?.close?.()}
            className="h-9 w-10 flex items-center justify-center rounded-md hover:bg-red-500 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          templates={templates}
          groups={templateGroups}
          sidebarOrder={sidebarOrder}
          onLayoutChange={(nextGroups, nextOrder) => {
            setTemplateGroups(nextGroups);
            setSidebarOrder(nextOrder);
          }}
          activeTemplateId={activeTemplateId}
          onTemplateSelect={setActiveTemplateId}
          onAddTemplate={handleAddTemplate}
          onEditTemplate={handleEditTemplate}
          onDeleteTemplate={(id) => setShowDeleteConfirm(id)}
          onPreviewRaw={(id) => {
            setRawPreviewShowSource(false);
            setPreviewRawId(id);
          }}
          onExport={handleExport}
          onImport={handleImport}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTemplate ? (
            <>
              <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-4 min-w-0">
                  <h2 className="font-semibold text-base dark:text-white truncate">{activeTemplate.name}</h2>
                  <div className="flex bg-slate-100 dark:bg-slate-900/40 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                    <button
                      onClick={() => setActiveTab('single')}
                      className={cn(
                        "px-4 py-1.5 text-sm rounded-md transition-all",
                        activeTab === 'single'
                          ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-medium"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      单条生成
                    </button>
                    <button
                      onClick={() => setActiveTab('batch')}
                      className={cn(
                        "px-4 py-1.5 text-sm rounded-md transition-all",
                        activeTab === 'batch'
                          ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-medium"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      批量生成
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                  <Settings2 className="w-4 h-4" />
                  {extractedVariables.length} 个变量识别
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden p-6 flex gap-6">
              {/* Left: Configuration */}
              <div className="w-1/2 flex flex-col gap-6 min-h-0">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border dark:border-slate-800 shadow-sm flex flex-col flex-1 min-h-0">
                  <h3 className="font-medium mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Edit2 className="w-4 h-4" /> 变量配置
                  </h3>
                              
                  <div className="flex-1 min-h-0 overflow-auto beautify-scrollbar pr-1">
                    <VariablesForm
                      variables={orderedVariables}
                      values={activeVariables}
                      onValueChange={(name, value) =>
                        setVariablesByTemplateId(prev => ({
                          ...prev,
                          [activeTemplateId]: { ...(prev[activeTemplateId] || {}), [name]: value }
                        }))
                      }
                      mode={activeTab}
                      batchInput={batchInput}
                      onBatchInputChange={setBatchInput}
                      onReorderVariables={(nextOrder) => {
                        if (!activeTemplate) return;
                        setTemplates(prev =>
                          prev.map(t => (t.id === activeTemplate.id ? { ...t, variableOrder: nextOrder } : t))
                        );
                      }}
                    />
                  </div>
                </div>
            
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border dark:border-slate-800 shadow-sm flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4" /> 模板内容预览
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPreviewShowSource(v => !v)}
                        className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                      >
                        {previewShowSource ? '显示预览' : '显示源代码'}
                      </button>
                      <button 
                        onClick={() => handleEditTemplate(activeTemplate)}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        修改模板
                      </button>
                    </div>
                  </div>
                  {previewShowSource ? (
                    <textarea
                      readOnly
                      value={activeTemplate.content}
                      className="flex-1 min-h-0 overflow-auto beautify-scrollbar bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 focus:outline-none"
                    />
                  ) : (
                    <div className="flex-1 min-h-0 overflow-auto overflow-x-hidden beautify-scrollbar bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                      <MarkdownViewer markdown={activeTemplate.content} className="text-slate-700 dark:text-slate-200" />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Results */}
              <div className="w-1/2 flex flex-col gap-6 min-h-0">
                <div className="bg-slate-900 dark:bg-slate-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-400" /> 生成结果
                    </h3>
                    <button 
                      onClick={() => {
                        if (activeTab === 'single') {
                          handleCopy(singleResult.content, 'result');
                        } else {
                          if (orderedVariables.length === 0) {
                            handleCopyMarkdown(activeTemplate?.content || '', 'result');
                            return;
                          }
                          handleCopyMarkdown(batchCopyMarkdown, 'result');
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                    >
                      {copyStatus === 'result' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {activeTab === 'single' ? '复制结果' : '全量复制'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto beautify-scrollbar px-4 pb-4 text-indigo-100/90 leading-relaxed">
                    {activeTab === 'single' ? (
                      <div className="pt-4 space-y-4">
                        <MarkdownViewer markdown={singleResult.content} className="text-indigo-100/90" />
                        {!singleResult.isComplete && Object.keys(activeVariables).length > 0 && (
                          <div className="p-3 bg-amber-900/30 border border-amber-800/50 rounded-lg flex items-center gap-2 text-amber-200 text-xs">
                            <AlertCircle className="w-4 h-4" />
                            部分变量尚未填写，生成内容可能不完整
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {orderedVariables.length === 0 ? (
                          <div className="pt-4 text-center py-20 text-slate-500 italic">
                            当前模板未识别到变量，无需使用批量生成，请切换到「单条生成」。
                          </div>
                        ) : batchResults.length > 0 ? (
                          <>
                            <div className="sticky top-0 z-10 -mx-4 px-4 pt-4 pb-3 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur border-b border-slate-800/60 dark:border-slate-700/60">
                              <div className="text-xs text-slate-300">目录</div>
                              <div className="mt-2 -mx-1 px-1 overflow-x-auto">
                                <div className="flex gap-2 whitespace-nowrap">
                                  {batchResults.map((_, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`batch-result-${idx}`);
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }}
                                      className="min-w-8 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                                    >
                                      {idx + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {batchResults.map((res, idx) => (
                              <div
                                key={idx}
                                id={`batch-result-${idx}`}
                                className={cn(
                                  "relative p-4 rounded-lg border scroll-mt-24",
                                  res.isValid ? "bg-slate-800/50 border-slate-700" : "bg-red-900/20 border-red-800/50"
                                )}
                              >
                                <div className="absolute -top-3 left-3 px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] text-slate-400 flex items-center gap-2">
                                  <span>#{idx + 1} {!res.isValid && ' - 变量数量不匹配'}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(res.prompt, `batch-${idx}`)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900/30 hover:bg-slate-900/55 transition-colors text-slate-200"
                                  >
                                    {copyStatus === `batch-${idx}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    复制
                                  </button>
                                </div>
                                <MarkdownViewer markdown={res.prompt} className="text-indigo-100/90" />
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="pt-4 text-center py-20 text-slate-500 italic">
                            请输入批量数据进行生成
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState onCreate={handleAddTemplate} />
        )}
      </div>
    </div>

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold dark:text-white">
                {editingTemplate?.id && templates.find(t => t.id === editingTemplate.id) ? '修改模板' : '创建新模板'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto beautify-scrollbar space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">模板名称</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                  value={editingTemplate?.name || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="例如：分镜头脚本生成 提示词模板"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">说明备注</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                  value={editingTemplate?.description || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  placeholder="简要描述模板用途"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">所属分组</label>
                <div ref={editorGroupPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setEditorGroupPickerOpen(v => !v)}
                    className="w-full px-4 py-2 border dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-left text-sm text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate">
                        {(() => {
                          const g = templateGroups.find(x => x.id === editingGroupId);
                          if (g) return g.name;
                          return templateGroups.length === 0 ? '请先创建组' : '选择分组';
                        })()}
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", editorGroupPickerOpen && "rotate-180")} />
                    </div>
                  </button>

                  {editorGroupPickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-[60]">
                      {templateGroups.length > 0 && (
                        <div className="max-h-56 overflow-y-auto beautify-scrollbar py-1">
                          {templateGroups.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setEditingGroupId(g.id);
                                setEditorGroupPickerOpen(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3",
                                editingGroupId === g.id && "bg-indigo-50 dark:bg-indigo-500/10"
                              )}
                            >
                              <span className="truncate">{g.name}</span>
                              {editingGroupId === g.id && <span className="text-xs text-indigo-600 dark:text-indigo-300">已选</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditorGroupPickerOpen(false);
                            setEditorCreateGroupOpen(true);
                            setEditorCreateGroupName('');
                          }}
                          className="w-full border border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center"
                        >
                          创建组
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">模板正文</label>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">使用 {"{变量名}"} 标记变量</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer transition-colors">
                        导入提示词
                        <input
                          type="file"
                          className="hidden"
                          accept=".md,.markdown,text/markdown,text/plain"
                          onChange={handleImportMdToEditor}
                        />
                      </label>

                      <div
                        className="relative"
                        onMouseEnter={() => setImportHintHover(true)}
                        onMouseLeave={() => {
                          setImportHintHover(false);
                          setImportHintPinned(false);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setImportHintPinned(true)}
                          onBlur={() => setImportHintPinned(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setImportHintPinned(false);
                          }}
                          className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          aria-label="导入提示词格式说明"
                          aria-describedby={(importHintPinned || importHintHover) ? 'import-hint-tooltip' : undefined}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {(importHintPinned || importHintHover) && (
                          <div
                            id="import-hint-tooltip"
                            role="tooltip"
                            className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-xl text-[11px] leading-relaxed text-slate-600 dark:text-slate-200 z-50"
                          >
                            <div className="absolute -top-1 right-2 h-2 w-2 rotate-45 bg-white dark:bg-slate-900 border-l border-t border-slate-200/70 dark:border-slate-700" />
                            仅支持 Markdown 格式文件（.md / .markdown）
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <MarkdownEditor
                  value={editingTemplate?.content || ''}
                  onChange={(value) => setEditingTemplate(prev => prev ? ({ ...prev, content: value }) : null)}
                  showSource={editorShowSource}
                  onToggleSource={() => setEditorShowSource(v => !v)}
                  placeholder="输入提示词正文，例如：请为我写一篇关于 {主题} 的文章，要求风格为 {风格}。"
                />
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 border dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors dark:text-white"
              >
                取消
              </button>
              <button 
                onClick={handleSaveTemplate}
                disabled={!editingTemplate?.name || !editingTemplate?.content}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
              >
                保存模板
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && editorCreateGroupOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]"
          onClick={() => setEditorCreateGroupOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">创建组</h3>
              <button
                type="button"
                onClick={() => setEditorCreateGroupOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">组名称</label>
              <input
                value={editorCreateGroupName}
                onChange={(e) => setEditorCreateGroupName(e.target.value)}
                placeholder="例如：内容创作 / 营销文案"
                className="w-full px-4 py-2 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                autoFocus
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorCreateGroupOpen(false)}
                className="px-5 py-2 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = createGroupWithName(editorCreateGroupName);
                  if (id) {
                    setEditingGroupId(id);
                    setEditorGroupPickerOpen(false);
                    setEditorCreateGroupOpen(false);
                    setEditorCreateGroupName('');
                  }
                }}
                disabled={!editorCreateGroupName.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {updateOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]"
          onClick={() => setUpdateOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">检查更新</h3>
              <button
                type="button"
                onClick={() => setUpdateOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-sm text-slate-600 dark:text-slate-200">
              {updateState.step === 'checking' && '正在检查更新…'}
              {updateState.step === 'none' && `当前已是最新版本（v${updateState.currentVersion}）`}
              {updateState.step === 'available' && (
                <div className="space-y-1">
                  <div>当前版本：v{updateState.currentVersion}</div>
                  <div>最新版本：v{updateState.latestVersion}</div>
                </div>
              )}
              {updateState.step === 'downloading' && `正在下载更新（v${updateState.latestVersion}）…`}
              {updateState.step === 'downloaded' && `更新已下载完成（v${updateState.latestVersion}），是否立即安装？`}
              {updateState.step === 'error' && `检查更新失败：${updateState.message}`}
              {updateState.step === 'idle' && '点击“检查更新”后会在此显示结果。'}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {updateState.step === 'available' && (
                <button
                  type="button"
                  onClick={startDownloadAndInstall}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                >
                  更新
                </button>
              )}
              {updateState.step === 'downloaded' && (
                <button
                  type="button"
                  onClick={() => window.appUpdate?.quitAndInstall?.()}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                >
                  立即安装
                </button>
              )}
              {updateState.step === 'checking' || updateState.step === 'downloading' ? (
                <button
                  type="button"
                  className="px-5 py-2 border dark:border-slate-700 rounded-xl opacity-60 cursor-not-allowed dark:text-white"
                  disabled
                >
                  请稍候
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setUpdateOpen(false)}
                  className="px-5 py-2 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-white"
                >
                  关闭
                </button>
              )}
              {updateState.step !== 'checking' && updateState.step !== 'downloading' && (
                <button
                  type="button"
                  onClick={checkForUpdates}
                  className="px-5 py-2 border border-indigo-200 dark:border-indigo-400/30 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  重新检查
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {aboutOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">关于</h3>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-200 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">一世提示词管理 v{__APP_VERSION__}</div>
              <div>用于团队沉淀与管理提示词模板：支持变量识别、单条/批量生成、复制以及导入导出，帮助将提示词生产流程标准化、可复用、可追溯。</div>
              
              <div className="text-xs text-slate-500 dark:text-slate-400">
                有问题请联系微信：a1meon
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2 dark:text-white">确认删除模板？</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">删除后模板数据将无法找回，请谨慎操作。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-white"
              >
                取消
              </button>
              <button 
                onClick={() => handleDeleteTemplate(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg shadow-red-100"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Preview Modal */}
      {previewRawId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
          <div className="bg-white dark:bg-slate-900 max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold dark:text-white">模板内容预览</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{templates.find(t => t.id === previewRawId)?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRawPreviewShowSource(v => !v)}
                  className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                >
                  {rawPreviewShowSource ? '显示预览' : '显示源代码'}
                </button>
                <button onClick={() => setPreviewRawId(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto beautify-scrollbar">
              {rawPreviewShowSource ? (
                <textarea
                  readOnly
                  value={templates.find(t => t.id === previewRawId)?.content || ''}
                  className="w-full min-h-[280px] overflow-auto beautify-scrollbar bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 focus:outline-none"
                />
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                  <MarkdownViewer markdown={templates.find(t => t.id === previewRawId)?.content || ''} className="text-slate-700 dark:text-slate-200" />
                </div>
              )}
            </div>
            <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => {
                  const content = templates.find(t => t.id === previewRawId)?.content || '';
                  handleCopy(content, 'raw-preview');
                }}
                className="px-6 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 dark:text-white"
              >
                {copyStatus === 'raw-preview' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                复制内容
              </button>
              <button 
                onClick={() => setPreviewRawId(null)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
