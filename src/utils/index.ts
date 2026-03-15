import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export { markdownToHtml, markdownToPlainText } from './markdown';

/**
 * 合并 Tailwind CSS 类名，支持 clsx 的条件类名语法
 * @param inputs 类名列表
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 从模板内容中提取变量名
 * @param content 模板内容
 * @returns 变量名数组
 */
export function extractVariables(content: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const matches = content.matchAll(regex);
  const uniqueVars = new Set<string>();
  for (const match of matches) {
    uniqueVars.add(match[1]);
  }
  return Array.from(uniqueVars);
}

/**
 * 生成提示词 - 替换模板中的变量
 * @param content 模板内容
 * @param variables 变量映射表
 * @returns 生成的提示词
 */
export function generatePrompt(content: string, variables: Record<string, string>): string {
  const source = content ?? '';
  return source.replace(/\{([^{}]+)\}/g, (_full, inner: string) => {
    const key = String(inner);
    const fromMap = variables[key] ?? variables[key.trim()] ?? '';
    const value = String(fromMap);
    return value.trim() === '' ? '' : value;
  });
}

/**
 * 复制到剪贴板
 * @param text 要复制的文本
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
