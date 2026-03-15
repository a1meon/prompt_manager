import React, { useCallback, useState } from 'react';
import { AlertCircle, GripVertical, Info } from 'lucide-react';

interface VariableInputProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * 单个变量输入组件
 */
export const VariableInput: React.FC<VariableInputProps> = ({ name, value, onChange }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
        {name}
      </label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`输入 ${name}...`}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all dark:text-white dark:placeholder-slate-500"
      />
    </div>
  );
};

interface BatchInputGuideProps {
  variables: string[];
}

/**
 * 批量输入指南组件
 */
export const BatchInputGuide: React.FC<BatchInputGuideProps> = ({ variables }) => {
  return (
    <div className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
      <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5" /> 批量输入规范
      </p>
      <ul className="list-disc list-inside space-y-0.5 opacity-80">
        <li>每行代表一组变量值</li>
        <li>多个变量用逗号 (中/英) 或制表符分隔</li>
        {variables.length > 0 && <li>按下方变量顺序填写</li>}
      </ul>
    </div>
  );
};

interface VariablesFormProps {
  variables: string[];
  values: Record<string, string>;
  onValueChange: (name: string, value: string) => void;
  mode: 'single' | 'batch';
  batchInput: string;
  onBatchInputChange: (value: string) => void;
  onReorderVariables?: (nextOrder: string[]) => void;
}

/**
 * 变量配置表单组件 - 支持单条和批量模式
 */
export const VariablesForm: React.FC<VariablesFormProps> = ({
  variables,
  values,
  onValueChange,
  mode,
  batchInput,
  onBatchInputChange,
  onReorderVariables
}) => {
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOverName, setDragOverName] = useState<string | null>(null);
  const [batchGuideOpen, setBatchGuideOpen] = useState(false);

  const reorder = useCallback((from: string, to: string) => {
    if (!onReorderVariables) return;
    if (from === to) return;
    const fromIndex = variables.indexOf(from);
    const toIndex = variables.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...variables];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorderVariables(next);
  }, [onReorderVariables, variables]);

  if (mode === 'single') {
    return (
      <div className="space-y-4">
        {variables.length > 0 ? (
          variables.map(v => (
            <div
              key={v}
              className={[
                "group rounded-lg",
                draggingName === v ? "opacity-60" : "",
                dragOverName === v && draggingName !== v ? "ring-2 ring-indigo-400/40" : ""
              ].join(' ')}
              onDragOver={(e) => {
                if (!onReorderVariables) return;
                e.preventDefault();
                if (dragOverName !== v) setDragOverName(v);
              }}
              onDrop={(e) => {
                if (!onReorderVariables) return;
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain') || draggingName;
                if (!from) return;
                reorder(from, v);
                setDraggingName(null);
                setDragOverName(null);
              }}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  draggable={!!onReorderVariables}
                  onDragStart={(e) => {
                    if (!onReorderVariables) return;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', v);
                    setDraggingName(v);
                  }}
                  onDragEnd={() => {
                    setDraggingName(null);
                    setDragOverName(null);
                  }}
                  className="mt-6 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  title="拖动排序"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <VariableInput
                    name={v}
                    value={values[v] || ''}
                    onChange={(val) => onValueChange(v, val)}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">当前模板无变量占位符</p>
            <p className="text-xs">使用 {"{变量名}"} 格式添加变量</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          变量顺序
        </div>
        <div
          className="relative"
          onMouseEnter={() => setBatchGuideOpen(true)}
          onMouseLeave={() => setBatchGuideOpen(false)}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            批量输入规范
          </button>
          {batchGuideOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 z-50">
              <div className="absolute -top-1 right-4 h-2 w-2 rotate-45 bg-amber-50 dark:bg-amber-900/20 border-l border-t border-amber-100 dark:border-amber-800/50" />
              <BatchInputGuide variables={variables} />
            </div>
          )}
        </div>
      </div>

      {variables.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
          <div className="-mx-1 px-1 overflow-x-auto">
            <div className="flex gap-2 whitespace-nowrap">
              {variables.map(v => (
                <div
                  key={v}
                  className={[
                    "rounded-md",
                    draggingName === v ? "opacity-60" : "",
                    dragOverName === v && draggingName !== v ? "ring-2 ring-indigo-400/40" : ""
                  ].join(' ')}
                  onDragOver={(e) => {
                    if (!onReorderVariables) return;
                    e.preventDefault();
                    if (dragOverName !== v) setDragOverName(v);
                  }}
                  onDrop={(e) => {
                    if (!onReorderVariables) return;
                    e.preventDefault();
                    const from = e.dataTransfer.getData('text/plain') || draggingName;
                    if (!from) return;
                    reorder(from, v);
                    setDraggingName(null);
                    setDragOverName(null);
                  }}
                >
                  <div
                    draggable={!!onReorderVariables}
                    onDragStart={(e) => {
                      if (!onReorderVariables) return;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', v);
                      setDraggingName(v);
                    }}
                    onDragEnd={() => {
                      setDraggingName(null);
                      setDragOverName(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-200 select-none cursor-grab active:cursor-grabbing"
                    title={onReorderVariables ? '拖动排序' : undefined}
                  >
                    {onReorderVariables && <GripVertical className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="max-w-40 truncate">{v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <textarea 
        className="w-full h-52 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all dark:text-white beautify-scrollbar"
        placeholder={`例：${variables.map(() => '值').join(', ')}`}
        value={batchInput}
        onChange={(e) => onBatchInputChange(e.target.value)}
      />
    </div>
  );
};
