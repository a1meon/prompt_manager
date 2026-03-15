import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, FileText, Layers, Download, Upload } from 'lucide-react';
import { cn } from '../utils';
import { Template } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  templates: Template[];
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
  onReorderTemplates: (nextTemplates: Template[]) => void;
}

/**
 * 侧边栏组件 - 模板列表管理
 */
export const Sidebar: React.FC<SidebarProps> = ({
  templates,
  activeTemplateId,
  onTemplateSelect,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onPreviewRaw,
  onExport,
  onImport,
  isDark,
  onToggleTheme,
  onReorderTemplates
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (!draggingId) return;
    const prev = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'grabbing';
    return () => {
      document.documentElement.style.cursor = prev;
    };
  }, [draggingId]);

  const moveToIndex = useCallback((fromId: string, toIndex: number) => {
    const fromIndex = templates.findIndex(t => t.id === fromId);
    if (fromIndex < 0) return;
    const safeToIndex = Math.max(0, Math.min(toIndex, templates.length - 1));
    if (fromIndex === safeToIndex) return;

    const next = [...templates];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(safeToIndex, 0, moved);
    onReorderTemplates(next);
  }, [onReorderTemplates, templates]);

  const reorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    const toIndex = templates.findIndex(t => t.id === toId);
    if (toIndex < 0) return;
    moveToIndex(fromId, toIndex);
  }, [moveToIndex, templates]);

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col shadow-sm">
      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
        <h1 className="font-bold text-lg flex items-center gap-2 dark:text-white">
          <Layers className="w-5 h-5 text-indigo-600" />
          提示词模板列表
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          <button 
            onClick={onAddTemplate}
            className="p-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div
        className="flex-1 overflow-y-auto beautify-scrollbar p-2 space-y-2 bg-slate-50 dark:bg-slate-950"
        onDragOver={(e) => {
          if (!draggingId) return;
          e.preventDefault();
          if (dragOverId !== '__end__') setDragOverId('__end__');
        }}
        onDrop={(e) => {
          if (!draggingId) return;
          e.preventDefault();
          const fromId = e.dataTransfer.getData('text/plain') || draggingId;
          if (!fromId) return;
          moveToIndex(fromId, templates.length - 1);
          setDraggingId(null);
          setDragOverId(null);
        }}
      >
        {templates.map(t => (
          <div 
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', t.id);
              setDraggingId(t.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
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
              const fromId = e.dataTransfer.getData('text/plain') || draggingId;
              if (!fromId) return;
              reorder(fromId, t.id);
              setDraggingId(null);
              setDragOverId(null);
            }}
            onClick={() => onTemplateSelect(t.id)}
            className={cn(
              "group relative p-3 rounded-xl transition-all select-none cursor-grab active:cursor-grabbing border shadow-sm",
              draggingId === t.id && "opacity-60",
              dragOverId === t.id && draggingId !== t.id && "ring-2 ring-indigo-400/50",
              activeTemplateId === t.id 
                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-400/20 shadow-md before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-indigo-500"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
            )}
          >
            <div className={cn(
              "font-medium truncate pr-6",
              activeTemplateId === t.id ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-slate-100"
            )}>{t.name}</div>
            <div className={cn(
              "text-xs truncate",
              activeTemplateId === t.id ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"
            )}>
              {t.description || '无备注说明'}
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onPreviewRaw(t.id); }}
                className={cn(
                  "p-1 rounded",
                  activeTemplateId === t.id ? "hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                )}
                title="查看原始内容"
              >
                <FileText className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onEditTemplate(t); }}
                className={cn(
                  "p-1 rounded",
                  activeTemplateId === t.id ? "hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                )}
                title="修改模板"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                className={cn(
                  "p-1 rounded",
                  activeTemplateId === t.id ? "hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-red-600 dark:text-red-400" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-red-500"
                )}
                title="删除模板"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {templates.length > 0 && (
          <div
            className={cn(
              "h-10 rounded-lg",
              draggingId && dragOverId === '__end__' && "ring-2 ring-indigo-400/30 bg-indigo-50/40 dark:bg-indigo-500/10"
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
    </div>
  );
};
