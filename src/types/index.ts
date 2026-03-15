export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  variableOrder?: string[];
}

export interface TemplateGroup {
  id: string;
  name: string;
  templateIds: string[];
  collapsed?: boolean;
}

export type SidebarOrderItem =
  | { type: 'template'; id: string }
  | { type: 'group'; id: string };

export type ActiveTab = 'single' | 'batch';

export type CopyStatusKey = string;

export interface EditingState {
  isEditing: boolean;
  template: Template | null;
}

export interface ThemeConfig {
  isDark: boolean;
  toggle: () => void;
}
