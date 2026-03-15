# 项目目录结构

```
demo/
├── .lingma/                          # Lingma AI 配置目录
│   ├── agents/                       # AI 代理配置
│   └── skills/                       # AI 技能配置
│
├── src/                              # 源代码目录
│   ├── components/                   # React 组件目录
│   │   ├── ThemeToggle.tsx           # 主题切换按钮组件
│   │   ├── Sidebar.tsx               # 侧边栏模板列表组件
│   │   ├── EmptyState.tsx            # 空状态提示组件
│   │   ├── VariablesForm.tsx         # 变量配置表单组件
│   │   │                             # 包含子组件：
│   │   │                             # - VariableInput (单个变量输入)
│   │   │                             # - BatchInputGuide (批量输入指南)
│   │   │                             # - VariablesForm (主表单)
│   │   └── index.ts                  # 组件统一导出文件
│   │
│   ├── types/                        # TypeScript 类型定义
│   │   └── index.ts                  # 类型和接口定义
│   │                                 # - Template (模板接口)
│   │                                 # - ActiveTab (标签类型)
│   │                                 # - ThemeConfig (主题配置)
│   │
│   ├── constants/                    # 常量管理
│   │   └── index.ts                  # 应用常量定义
│   │                                 # - DEFAULT_TEMPLATES (默认模板)
│   │                                 # - STORAGE_KEY (存储键名)
│   │                                 # - THEME_STORAGE_KEY (主题存储键)
│   │
│   ├── utils/                        # 工具函数
│   │   └── index.ts                  # 通用工具函数
│   │                                 # - cn() (类名合并)
│   │                                 # - extractVariables() (提取变量)
│   │                                 # - generatePrompt() (生成提示词)
│   │                                 # - copyToClipboard() (复制功能)
│   │
│   ├── App.tsx                       # 主应用组件（重构后）
│   ├── main.tsx                      # 应用入口文件
│   └── index.css                     # 全局样式（含主题定义）
│
├── .gitignore                        # Git 忽略配置
├── index.html                        # HTML 入口文件
├── package.json                      # 项目依赖配置
├── package-lock.json                 # 依赖锁定文件
├── postcss.config.js                 # PostCSS 配置
├── tailwind.config.js                # Tailwind CSS 配置
├── vite.config.ts                    # Vite 构建配置
├── tsconfig.json                     # TypeScript 配置
├── PROJECT_OPTIMIZATION.md           # 项目优化说明文档
└── README.md                         # 项目说明文档
```

## 📁 核心模块说明

### 1. **components/** - 可复用组件库
所有 UI 组件都采用原子化设计，每个组件职责单一，易于维护和复用。

### 2. **types/** - 类型系统中心
统一管理所有 TypeScript 类型定义，确保类型安全。

### 3. **constants/** - 常量管理中心
集中管理应用常量，避免硬编码字符串。

### 4. **utils/** - 工具函数库
提供通用功能函数，支持业务逻辑处理。

## 🎯 架构优势

### ✅ 模块化设计
- 每个目录职责明确
- 组件高度解耦
- 易于单元测试

### ✅ 可扩展性
- 新增功能只需添加对应模块
- 不影响现有代码
- 支持快速迭代

### ✅ 可维护性
- 代码组织清晰
- 命名规范统一
- 注释完善

### ✅ 类型安全
- 完整的 TypeScript 支持
- 编译时错误检测
- IDE 智能提示

## 🔄 数据流向

```
用户交互 → Components → App.tsx (状态管理)
                           ↓
                    Utils (数据处理)
                           ↓
                    Constants (配置)
                           ↓
                    Types (类型约束)
                           ↓
LocalStorage (持久化)
```

## 🎨 主题系统

```
index.css (主题样式定义)
    ↓
tailwind.config.js (darkMode: 'class')
    ↓
App.tsx (主题状态管理)
    ↓
ThemeToggle (用户交互)
    ↓
localStorage (偏好保存)
```
