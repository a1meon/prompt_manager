import React from 'react';
import { Layers, PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  onCreate: () => void;
}

/**
 * 空状态组件 - 当没有选择模板时显示
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ onCreate }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Layers className="w-16 h-16 opacity-10" />
      <div className="text-center">
        <p className="text-lg font-medium">请选择或创建一个模板</p>
        <button 
          onClick={onCreate}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto"
        >
          <PlusCircle className="w-5 h-5" /> 立即创建
        </button>
      </div>
    </div>
  );
};
