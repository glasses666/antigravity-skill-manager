# Antigravity Skill Manager (反重力技能管理器)

[English](README.md) | [中文](README_zh-CN.md)

Antigravity Skill Manager 是一个 VS Code 扩展，旨在增强您的 AI 编程助手体验。它允许您直接在 VS Code 中发现、管理和安装适用于 Claude Code 和 Antigravity 的 "Skills"（专用指令和工具）。

![演示截图](https://raw.githubusercontent.com/glasses666/antigravity-skill-manager/main/media/demo.png)

## 功能特性

### 🏪 技能商店 (Skill Store)
直接在 VS Code 中浏览海量社区技能。
- **丰富的 UI**: 类似扩展商店的界面，包含图标、评分和作者信息。
- **搜索**: 即时搜索 GitHub 上的技能。
- **一键安装**: 无需离开编辑器即可轻松安装技能。
- **GitHub 认证**: 内置 GitHub 认证，解决 API速率限制问题。

### 📄 技能详情
安装前查看技能的详细信息。
- **README 渲染**: 自动渲染技能的 `README.md` 或 `SKILL.md`，支持完整的 Markdown 格式（表格、图片、链接）。
- **元数据**:查看 Star 数、Fork 数、验证状态和最后更新时间。
- **图片支持**: 自动处理 README 中的图片，确保正确显示。

### ☁️ GitHub 集成
- **官方技能**: 浏览来自 `anthropics/skills` 的精选技能。
- **社区发现**: 利用 `SKILL.md` 标记自动发现社区技能。
- **仅限验证**: 过滤仓库，确保只显示带有文档的有效技能。

### 📁 本地管理
- 在 `~/.gemini/antigravity/skills`（或自定义路径）中管理已安装的技能。
- 使用本地模板快速创建新技能。
- 直接在 VS Code 中编辑现有技能。

## 安装指南

1. 在 VS Code 中打开本项目。
2. 运行 `npm install` 安装依赖。
3. 按 `F5` 在新的调试窗口中启动扩展。

## 使用说明

1. **打开管理器**: 点击活动栏中的 🧠 图标。
2. **浏览技能**:
   - **Local Skills**: 本机已安装的技能。
   - **GitHub - Official**: Anthropic 官方精选技能。
   - **Skill Store**: 可搜索的社区市场。
3. **安装**: 点击任意技能卡片上的 "安装" 按钮，或右键点击树状项。
4. **查看详情**: 点击任意技能卡片打开详情 Webview。

## 配置选项

| 设置 | 描述 | 默认值 |
|------|------|--------|
| `antigravity.skillsPath` | 自定义技能安装目录 | `~/.gemini/antigravity/skills` |
| `antigravity.githubToken` | (可选) GitHub API 个人访问令牌 | - |
| `antigravity.minStars` | 社区技能最低 Star 数过滤 | 0 |
| `antigravity.showUnverifiedSkills` | 显示没有 `SKILL.md` 的仓库 | `false` |

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。
