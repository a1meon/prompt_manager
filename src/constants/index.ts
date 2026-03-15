import { Template } from '../types';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-1',
    name: '影视分镜创作',
    description: '适用于生成影视分镜描述，包含镜头、构图、光影等。',
    content: '镜头类型：{镜头类型}\n构图方式：{构图方式}\n画面内容描述：{画面内容}\n光影效果：{光影效果}\n色调风格：{色调风格}\n拍摄手法：{拍摄手法}'
  }
];

export const STORAGE_KEY = 'prompt_templates_v1';
export const TEMPLATE_VARIABLES_STORAGE_KEY = 'prompt_template_variables_v1';
export const THEME_STORAGE_KEY = 'prompt_manager_theme';
