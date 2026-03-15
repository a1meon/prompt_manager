# 开发指南

## 🚀 快速开始

### 环境要求
- Node.js >= 18.x
- npm >= 9.x

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:5175 (或终端显示的端口)

### 构建生产版本
```bash
npm run build
```

### 预览生产构建
```bash
npm run preview
```

---

## 🎨 主题切换功能

### 默认行为
- 系统**默认使用浅色主题**
- 所有浏览器统一显示为浅色（修复了 Chrome 深色问题）

### 切换主题
1. 点击右上角的 🌙 或 ☀️ 按钮
2. 主题会自动切换到深色/浅色模式
3. 偏好设置会保存到本地存储

### 代码示例
```tsx
// App.tsx 中的主题管理
const [isDark, setIsDark] = useState(false);

// 初始化时读取保存的主题
useEffect(() => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) {
    setIsDark(savedTheme === 'dark');
  }
}, []);

// 切换主题并保存
useEffect(() => {
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [isDark]);
```

---

## 📝 代码规范

### 命名约定

#### 文件和目录
- **组件文件**: PascalCase (如 `ThemeToggle.tsx`)
- **工具函数**: camelCase (如 `generatePrompt.ts`)
- **类型定义**: PascalCase (如 `Template.ts`)
- **常量**: UPPER_CASE (如 `STORAGE_KEY.ts`)

#### 变量和函数
```typescript
// ✅ 好的命名
interface Template { ... }
const DEFAULT_TEMPLATES = [...]
function generatePrompt() { ... }
const activeTemplate = ...

// ❌ 不好的命名
interface template { ... }
const defaultTemplates = [...]  // 常量应用大写
function GeneratePrompt() { ... }  // 函数应小写开头
```

### 组件结构

```tsx
import React from 'react';
import { Icon } from 'lucide-react';
import { cn } from '../utils';
import { ComponentProps } from '../types';

/**
 * 组件说明文档
 * @param props - 组件属性
 */
export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // 1. Hooks 调用
  const [state, setState] = useState();
  
  // 2. 事件处理函数
  const handleClick = () => { ... };
  
  // 3. 计算逻辑
  const computedValue = useMemo(() => { ... }, []);
  
  // 4. 返回 JSX
  return (
    <div className={cn("base-styles", prop1 && "conditional-style")}>
      {/* 组件内容 */}
    </div>
  );
};
```

### 样式编写规范

#### Tailwind CSS 类名组织
```tsx
// ✅ 好的做法
<div className={cn(
  "flex items-center gap-2",           // 布局
  "p-4 rounded-xl border",             // 外观
  "bg-white dark:bg-slate-900",        // 背景色
  "border-slate-200 dark:border-slate-700",  // 边框色
  "hover:bg-slate-50 dark:hover:bg-slate-800" // 交互状态
)}>

// ❌ 不好的做法 - 类名混乱
<div className="flex p-4 bg-white rounded-xl hover:bg-slate-50 border items-center">
```

#### 深色模式支持
```tsx
// 必须为每个浅色样式添加对应的深色样式
<div className="bg-white dark:bg-slate-900 
                text-slate-900 dark:text-slate-100
                border-slate-200 dark:border-slate-800">
```

---

## 🔧 常用工具函数

### cn() - 类名合并
```tsx
import { cn } from './utils';

<div className={cn(
  "base-class",
  isActive && "active-class",
  size === 'large' ? "text-lg" : "text-sm"
)} />
```

### extractVariables() - 提取模板变量
```tsx
import { extractVariables } from './utils';

const content = 'Hello {name}, welcome to {place}!';
const variables = extractVariables(content);
// 返回：['name', 'place']
```

### generatePrompt() - 生成提示词
```tsx
import { generatePrompt } from './utils';

const template = 'Hello {name}!';
const variables = { name: 'World' };
const result = generatePrompt(template, variables);
// 返回：'Hello World!'
```

### copyToClipboard() - 复制功能
```tsx
import { copyToClipboard } from './utils';

await copyToClipboard('要复制的文本');
```

---

## 🧩 自动更新（GitHub Releases）

项目使用 `electron-updater` 对接 GitHub Releases，应用启动时会检查更新并自动下载，下载完成后提示用户一键安装。

### 工作原理

- `package.json` 的 `build.publish` 指定 GitHub 仓库（owner/repo）
- 应用打包后会生成更新元数据文件并用于更新检查
- 仅在 `app.isPackaged` 时启用更新检查（开发模式不检查）

### 发布流程（建议）

1. 修改版本号：更新 `package.json` 的 `version`
2. 更新更新记录：完善 `CHANGELOG.md`
3. 产物清理并打包：
   - `npm run clean:pack`
   - `npm run pack:installer`
4. 在 GitHub 创建 Release（建议 tag 为 `vX.Y.Z`），上传打包产物
5. 安装版用户下次启动会自动拉取新版本并提示安装

---

## 📦 新增组件指南

### 1. 创建组件文件
```tsx
// src/components/NewComponent.tsx
import React from 'react';
import { cn } from '../utils';

interface NewComponentProps {
  // 定义属性
}

export const NewComponent: React.FC<NewComponentProps> = ({}) => {
  return <div>New Component</div>;
};
```

### 2. 导出组件
```ts
// src/components/index.ts
export { NewComponent } from './NewComponent';
```

### 3. 在主应用中使用
```tsx
import { NewComponent } from './components';

function App() {
  return <NewComponent />;
}
```

---

## 🐛 调试技巧

### 查看组件状态
在组件中添加日志：
```tsx
useEffect(() => {
  console.log('Component state:', { state1, state2 });
}, [state1, state2]);
```

### 检查主题问题
```tsx
useEffect(() => {
  console.log('Is Dark:', isDark);
  console.log('HTML classList:', document.documentElement.classList);
}, [isDark]);
```

### 性能优化
使用 React.memo 避免不必要的重渲染：
```tsx
export const MemoizedComponent = React.memo(({ data }) => {
  return <div>{data}</div>;
});
```

---

## 📱 响应式设计

项目已支持完整的响应式布局，使用 Tailwind 的断点：

```tsx
<div className="
  w-full              // 默认宽度
  md:w-1/2            // ≥768px
  lg:w-1/3            // ≥1024px
  xl:w-1/4            // ≥1280px
">
```

---

## 🎯 最佳实践

### 1. 组件职责单一
每个组件只负责一个功能，复杂功能拆分为子组件。

### 2. Props 类型定义
始终使用 TypeScript 接口定义 Props：
```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}
```

### 3. 错误边界
为关键组件添加错误处理：
```tsx
try {
  // 可能出错的逻辑
} catch (error) {
  console.error('Error:', error);
  // 降级处理
}
```

### 4. 性能优化
- 使用 useMemo 缓存计算结果
- 使用 useCallback 缓存函数
- 大列表使用虚拟滚动

---

## 🔍 常见问题

### Q: 如何添加新的模板变量格式？
A: 修改 `utils/extractVariables()` 中的正则表达式。

### Q: 如何自定义主题颜色？
A: 修改 `tailwind.config.js` 中的 theme.extend.colors。

### Q: 如何添加新的深色模式样式？
A: 在现有类名后添加 `dark:` 前缀的对应样式。

---

## 📚 参考资源

- [React 官方文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Lucide 图标库](https://lucide.dev/)
- [Vite 文档](https://vitejs.dev/)
