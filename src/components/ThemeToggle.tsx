import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../utils';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

/**
 * 主题切换按钮组件
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        "hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
};
