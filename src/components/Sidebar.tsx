import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Plus, Trash2, Edit2, FileText, Folder, Layers, Download, Upload, GripVertical } from 'lucide-react';
import { cn } from '../utils';
import { Template, TemplateGroup, SidebarOrderItem } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  templates: Template[];
  groups: TemplateGroup[];
  sidebarOrder: SidebarOrderItem[];
  onLayoutChange: (nextGroups: TemplateGroup[], nextOrder: SidebarOrderItem[]) => void;
  activeTemplateId: string;
  onTemplateSelect: (id: string) => void;
  onAddTemplate: () => void;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (id: string) => void;
  onPreviewRaw: (id: string) => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

/**
 * 侧边栏组件 - 模板列表管理
 */
export const Sidebar: React.FC<SidebarProps> = ({
  templates,
  groups,
  sidebarOrder,
  onLayoutChange,
  activeTemplateId,
  onTemplateSelect,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onPreviewRaw,
  onExport,
  onImport,
  isDark,
  onToggleTheme
}) => {
  const [dragging, setDragging] = useState<
    | { type: 'template'; id: string; fromGroupId?: string }
    | { type: 'group'; id: string }
    | null
  >(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameGroupOpen, setRenameGroupOpen] = useState(false);
  const [renameGroupId, setRenameGroupId] = useState('');
  const [renameGroupName, setRenameGroupName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const prev = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'grabbing';
    return () => {
      document.documentElement.style.cursor = prev;
    };
  }, [dragging]);

  useEffect(() => {
    if (!addMenuOpen && !contextMenu.open) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (addMenuOpen && addMenuRef.current && target && addMenuRef.current.contains(target)) return;
      if (contextMenu.open && contextMenuRef.current && target && contextMenuRef.current.contains(target)) return;
      setAddMenuOpen(false);
      setContextMenu(prev => (prev.open ? { ...prev, open: false } : prev));
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAddMenuOpen(false);
      setContextMenu(prev => (prev.open ? { ...prev, open: false } : prev));
    };
    document.addEventListener('mousedown', handleDown, true);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleDown, true);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [addMenuOpen, contextMenu.open]);

  const templatesById = useCallback(() => new Map(templates.map(t => [t.id, t])), [templates]);

  const groupedTemplateIdSet = useCallback(() => {
    const set = new Set<string>();
    groups.forEach(g => (g.templateIds || []).forEach(id => set.add(id)));
    return set;
  }, [groups]);

  const normalizeLayout = useCallback((nextGroups: TemplateGroup[], nextOrder: SidebarOrderItem[]) => {
    const templateIdSet = new Set(templates.map(t => t.id));
    const groupIdSet = new Set(nextGroups.map(g => g.id));
    const cleanedGroups = nextGroups
      .map(g => ({
        ...g,
        templateIds: Array.from(new Set((g.templateIds || []).filter(id => templateIdSet.has(id))))
      }))
      .filter(g => Boolean((g.name || '').trim()));
    const groupedIds = new Set(cleanedGroups.flatMap(g => g.templateIds));
    const cleanedOrder = nextOrder.filter(item => {
      if (item.type === 'group') return groupIdSet.has(item.id);
      return templateIdSet.has(item.id) && !groupedIds.has(item.id);
    });
    const existingRootTemplateIds = new Set(cleanedOrder.filter(i => i.type === 'template').map(i => i.id));
    const missingRootTemplates = templates
      .map(t => t.id)
      .filter(id => !groupedIds.has(id) && !existingRootTemplateIds.has(id))
      .map(id => ({ type: 'template' as const, id }));
    return { groups: cleanedGroups, order: [...cleanedOrder, ...missingRootTemplates] };
  }, [templates]);

  const parseDragData = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.type === 'template' && parsed.id) return parsed as { type: 'template'; id: string; fromGroupId?: string };
      if (parsed && parsed.type === 'group' && parsed.id) return parsed as { type: 'group'; id: string };
      return null;
    } catch {
      return null;
    }
  };

  const setLayout = (nextGroups: TemplateGroup[], nextOrder: SidebarOrderItem[]) => {
    const normalized = normalizeLayout(nextGroups, nextOrder);
    onLayoutChange(normalized.groups, normalized.order);
  };

  const createGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setLayout(
      [{ id, name, templateIds: [], collapsed: false }, ...groups],
      [{ type: 'group', id }, ...sidebarOrder]
    );
    setCreateGroupOpen(false);
    setNewGroupName('');
  };

  const toggleGroup = (groupId: string) => {
    setLayout(
      groups.map(g => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)),
      sidebarOrder
    );
  };

  const renameGroup = (groupId: string) => {
    const current = groups.find(g => g.id === groupId);
    if (!current) return;
    setRenameGroupId(groupId);
    setRenameGroupName(current.name || '');
    setRenameGroupOpen(true);
  };

  const deleteGroup = (groupId: string) => {
    const targetIndex = sidebarOrder.findIndex(i => i.type === 'group' && i.id === groupId);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const ok = window.confirm(`确认删除分组「${group.name}」？分组内模板会移动到未分组区域。`);
    if (!ok) return;
    const remainingGroups = groups.filter(g => g.id !== groupId);
    const remainingOrder = sidebarOrder.filter(i => !(i.type === 'group' && i.id === groupId));
    const moveTemplates = (group.templateIds || []).map(id => ({ type: 'template' as const, id }));
    const insertAt = targetIndex >= 0 ? targetIndex : 0;
    const nextOrder = [...remainingOrder.slice(0, insertAt), ...moveTemplates, ...remainingOrder.slice(insertAt)];
    setLayout(remainingGroups, nextOrder);
  };

  const moveGroupInOrder = (fromGroupId: string, toIndex: number) => {
    const fromIndex = sidebarOrder.findIndex(i => i.type === 'group' && i.id === fromGroupId);
    if (fromIndex < 0) return;
    const next = [...sidebarOrder];
    const [moved] = next.splice(fromIndex, 1);
    const safeToIndex = Math.max(0, Math.min(toIndex, next.length));
    next.splice(safeToIndex, 0, moved);
    setLayout(groups, next);
  };

  const moveTemplate = (
    templateId: string,
    fromGroupId: string | undefined,
    to: { type: 'root'; index: number } | { type: 'group'; groupId: string; index: number }
  ) => {
    const nextGroups = groups.map(g => ({
      ...g,
      templateIds: (g.templateIds || []).filter(id => id !== templateId)
    }));
    if (to.type === 'root') {
      const nextOrder = sidebarOrder.filter(i => !(i.type === 'template' && i.id === templateId));
      const safeIndex = Math.max(0, Math.min(to.index, nextOrder.length));
      nextOrder.splice(safeIndex, 0, { type: 'template', id: templateId });
      setLayout(nextGroups, nextOrder);
      return;
    }
    const target = nextGroups.find(g => g.id === to.groupId);
    if (!target) return;
    const ids = [...(target.templateIds || [])].filter(id => id !== templateId);
    const safeIndex = Math.max(0, Math.min(to.index, ids.length));
    ids.splice(safeIndex, 0, templateId);
    setLayout(
      nextGroups.map(g => (g.id === to.groupId ? { ...g, templateIds: ids } : g)),
      sidebarOrder
    );
  };

  const rootItems = (() => {
    const grouped = groupedTemplateIdSet();
    const orderTemplateIds = new Set(sidebarOrder.filter(i => i.type === 'template').map(i => i.id));
    const missingRoot = templates
      .map(t => t.id)
      .filter(id => !grouped.has(id) && !orderTemplateIds.has(id))
      .map(id => ({ type: 'template' as const, id }));
    return [...sidebarOrder, ...missingRoot];
  })();

  return (
    <div className="relative w-80 bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col shadow-sm">
      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
        <h1 className="font-bold text-lg flex items-center gap-2 dark:text-white">
          <Layers className="w-5 h-5 text-indigo-600" />
          提示词模板列表
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          <div
            ref={addMenuRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() => setAddMenuOpen(v => !v)}
              className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
            >
              <Plus className="w-4 h-4" />
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden z-50">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => {
                    setAddMenuOpen(false);
                    onAddTemplate();
                  }}
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  创建提示词模板
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => {
                    setAddMenuOpen(false);
                    setCreateGroupOpen(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4 text-slate-500" />
                  创建分组
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div
        className="flex-1 overflow-y-auto beautify-scrollbar p-2 space-y-2 bg-slate-50 dark:bg-slate-950"
        onContextMenu={(e) => {
          const target = e.target as HTMLElement | null;
          if (target && target.closest('[data-sidebar-item="true"]')) return;
          e.preventDefault();
          setAddMenuOpen(false);
          setContextMenu({ open: true, x: e.clientX, y: e.clientY });
        }}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          if (dragOverId !== '__end__') setDragOverId('__end__');
        }}
        onDrop={(e) => {
          if (!dragging) return;
          e.preventDefault();
          const data = parseDragData(e) || dragging;
          if (!data) return;
          if (data.type === 'template') {
            moveTemplate(data.id, data.fromGroupId, { type: 'root', index: rootItems.length });
          }
          if (data.type === 'group') {
            moveGroupInOrder(data.id, rootItems.length);
          }
          setDragging(null);
          setDragOverId(null);
        }}
      >
        {rootItems.map(item => {
          if (item.type === 'group') {
            const group = groups.find(g => g.id === item.id);
            if (!group) return null;
            const isOpen = !group.collapsed;
            return (
              <div
                key={`group-${group.id}`}
                data-sidebar-item="true"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
              >
                <div
                  onDragOver={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (dragOverId !== `group-${group.id}`) setDragOverId(`group-${group.id}`);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = parseDragData(e) || dragging;
                    if (!data) return;
                    if (data.type === 'group') {
                      const toIndex = rootItems.findIndex(i => i.type === 'group' && i.id === group.id);
                      moveGroupInOrder(data.id, toIndex);
                    }
                    if (data.type === 'template') {
                      moveTemplate(data.id, data.fromGroupId, { type: 'group', groupId: group.id, index: (group.templateIds || []).length });
                    }
                    setDragging(null);
                    setDragOverId(null);
                  }}
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "group flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none",
                    "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                    dragOverId === `group-${group.id}` && dragging?.type === 'group' && dragging.id !== group.id && "ring-2 ring-indigo-400/40"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      draggable
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = 'move';
                        const payload = JSON.stringify({ type: 'group', id: group.id });
                        e.dataTransfer.setData('application/json', payload);
                        e.dataTransfer.setData('text/plain', payload);
                        setDragging({ type: 'group', id: group.id });
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOverId(null);
                      }}
                      className="p-1 -ml-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing"
                      title="拖动排序"
                      aria-label="拖动排序"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <Folder className="w-4 h-4 text-indigo-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{group.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{(group.templateIds || []).length} 个模板</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        renameGroup(group.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      draggable={false}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                      title="编辑分组"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGroup(group.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      draggable={false}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
                      title="删除分组"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-2 pb-2 space-y-2">
                    {(group.templateIds || []).map((tid, idx) => {
                      const tpl = templatesById().get(tid);
                      if (!tpl) return null;
                      return (
                        <div
                          key={`group-${group.id}-tpl-${tpl.id}`}
                          data-sidebar-item="true"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            const payload = JSON.stringify({ type: 'template', id: tpl.id, fromGroupId: group.id });
                            e.dataTransfer.setData('application/json', payload);
                            e.dataTransfer.setData('text/plain', payload);
                            setDragging({ type: 'template', id: tpl.id, fromGroupId: group.id });
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDragOverId(null);
                          }}
                          onDragOver={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (dragOverId !== tpl.id) setDragOverId(tpl.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const data = parseDragData(e) || dragging;
                            if (!data || data.type !== 'template') return;
                            moveTemplate(data.id, data.fromGroupId, { type: 'group', groupId: group.id, index: idx });
                            setDragging(null);
                            setDragOverId(null);
                          }}
                          onClick={() => onTemplateSelect(tpl.id)}
                          className={cn(
                            "group relative p-3 rounded-xl transition-all select-none cursor-grab active:cursor-grabbing border shadow-sm",
                            dragging?.type === 'template' && dragging.id === tpl.id && "opacity-60",
                            dragOverId === tpl.id && dragging?.type === 'template' && dragging.id !== tpl.id && "ring-2 ring-indigo-400/50",
                            activeTemplateId === tpl.id
                              ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-400/20 shadow-md before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-indigo-500"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                          )}
                        >
                          <div className="font-medium truncate pr-6 text-slate-900 dark:text-slate-100">{tpl.name}</div>
                          <div className="text-xs truncate text-slate-500 dark:text-slate-400">{tpl.description || '无备注说明'}</div>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreviewRaw(tpl.id);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                              title="查看原始内容"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTemplate(tpl);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                              title="修改模板"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTemplate(tpl.id);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
                              title="删除模板"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const t = templatesById().get(item.id);
          if (!t) return null;
          return (
            <div
              key={`tpl-${t.id}`}
              data-sidebar-item="true"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                const payload = JSON.stringify({ type: 'template', id: t.id });
                e.dataTransfer.setData('application/json', payload);
                e.dataTransfer.setData('text/plain', payload);
                setDragging({ type: 'template', id: t.id });
              }}
              onDragEnd={() => {
                setDragging(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (dragOverId !== t.id) setDragOverId(t.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const data = parseDragData(e) || dragging;
                if (!data) return;
                const toIndex = rootItems.findIndex(i => i.type === 'template' && i.id === t.id);
                if (data.type === 'group') {
                  moveGroupInOrder(data.id, toIndex);
                }
                if (data.type === 'template') {
                  moveTemplate(data.id, data.fromGroupId, { type: 'root', index: toIndex });
                }
                setDragging(null);
                setDragOverId(null);
              }}
              onClick={() => onTemplateSelect(t.id)}
              className={cn(
                "group relative p-3 rounded-xl transition-all select-none cursor-grab active:cursor-grabbing border shadow-sm",
                dragging?.type === 'template' && dragging.id === t.id && "opacity-60",
                dragOverId === t.id && dragging?.type === 'template' && dragging.id !== t.id && "ring-2 ring-indigo-400/50",
                activeTemplateId === t.id
                  ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-400/20 shadow-md before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-indigo-500"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
              )}
            >
              <div className="font-medium truncate pr-6 text-slate-900 dark:text-slate-100">{t.name}</div>
              <div className="text-xs truncate text-slate-500 dark:text-slate-400">{t.description || '无备注说明'}</div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewRaw(t.id);
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                  title="查看原始内容"
                >
                  <FileText className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTemplate(t);
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                  title="修改模板"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTemplate(t.id);
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
                  title="删除模板"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {templates.length > 0 && (
          <div
            data-sidebar-empty="true"
            className={cn(
              "h-10 rounded-lg",
              dragging && dragOverId === '__end__' && "ring-2 ring-indigo-400/30 bg-indigo-50/40 dark:bg-indigo-500/10"
            )}
          />
        )}
      </div>
      
      <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-2">
        <div className="flex gap-2">
          <button 
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-2 text-xs py-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3 h-3" /> 导出提示词
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 text-xs py-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
            <Upload className="w-3 h-3" /> 导入提示词
            <input type="file" className="hidden" accept=".json" onChange={onImport} />
          </label>
        </div>
      </div>

      {contextMenu.open && (
        <div
          className="fixed inset-0 z-[100]"
          onMouseDown={() => setContextMenu(prev => ({ ...prev, open: false }))}
        >
          <div
            ref={contextMenuRef}
            className="fixed w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                setContextMenu(prev => ({ ...prev, open: false }));
                onAddTemplate();
              }}
            >
              <FileText className="w-4 h-4 text-slate-500" />
              创建提示词模板
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              onClick={() => {
                setContextMenu(prev => ({ ...prev, open: false }));
                setCreateGroupOpen(true);
              }}
            >
              <FolderPlus className="w-4 h-4 text-slate-500" />
                  创建分组
            </button>
          </div>
        </div>
      )}

      {createGroupOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[120]"
          onClick={() => setCreateGroupOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              创建分组
            </div>
            <div className="mt-3">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入分组名称"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:ring-inset focus:outline-none"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={createGroup}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {renameGroupOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[120]"
          onClick={() => setRenameGroupOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" />
              编辑分组
            </div>
            <div className="mt-3">
              <input
                value={renameGroupName}
                onChange={(e) => setRenameGroupName(e.target.value)}
                placeholder="输入分组名称"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:ring-inset focus:outline-none"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameGroupOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = renameGroupName.trim();
                  if (!name) return;
                  setLayout(
                    groups.map(g => (g.id === renameGroupId ? { ...g, name } : g)),
                    sidebarOrder
                  );
                  setRenameGroupOpen(false);
                  setRenameGroupId('');
                  setRenameGroupName('');
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
