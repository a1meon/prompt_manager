# 一世提示词管理（Prompt Manager）

一个用于管理提示词模板、提取变量、单条/批量生成与复制结果的桌面应用（Electron + React + Vite）。

## 功能概览

- 模板管理：创建、编辑、删除、预览提示词模板
- 变量识别：使用 `{变量名}` 标记变量并自动识别
- 单条生成：逐变量填写并实时生成结果
- 批量生成：按行输入变量值批量生成，支持目录快速定位
- 导入导出：导入/导出模板 JSON；在编辑模板时导入 Markdown 文本作为模板内容
- 复制能力：复制结果（单条）与全量复制（批量）
- 主题切换：浅色/深色主题

## 技术栈

- Electron（桌面壳）
- React 18 + TypeScript
- Vite（构建与开发）
- Tailwind CSS（样式）
- TipTap（Markdown 编辑）

## 环境要求

- Node.js 18+（建议 18/20 LTS）
- npm 9+

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 启动开发环境（Vite）

```bash
npm run dev
```

3. 生产构建

```bash
npm run build
```

4. 预览构建产物

```bash
npm run preview
```

## 打包发布（Windows）

本项目提供 Electron Builder 打包脚本（见 `package.json` 的 `scripts`）：

```bash
# 生成安装包（NSIS）
npm run pack:installer

# 生成便携版 EXE
npm run pack:exe
```

## 文档

- 使用手册：见 [USER_MANUAL.md](./USER_MANUAL.md)
- 更新记录：见 [CHANGELOG.md](./CHANGELOG.md)
- 研发说明：见 [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)

## 目录结构

核心目录结构说明见 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)。

## 版本与发布规范（建议）

- 建议使用语义化版本（SemVer）：`MAJOR.MINOR.PATCH`
- 每次发布需更新 `CHANGELOG.md`，并打 Git tag（例如 `v1.0.1`）

## 安全与合规

- 不要在仓库中提交任何密钥、Token 或个人敏感信息
- `.env*` 已默认忽略；如需配置本地环境变量，请使用 `.env.local` 等本地文件

