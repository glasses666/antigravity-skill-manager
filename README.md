# Antigravity Skill Manager

VS Code扩展，用于管理Antigravity/Claude Code的skills。

## 功能

- 📁 **本地Skills管理** - 浏览、创建、编辑本地已安装的skills
- ☁️ **GitHub官方仓库** - 浏览anthropics/skills官方技能
- ⭐ **社区Skills** - 搜索和安装awesome-claude-skills社区精选
- 🔍 **高级过滤** - 按分类、Star数、更新时间过滤
- ✅ **SKILL.md验证** - 只显示包含有效SKILL.md的仓库

## 安装

1. 打开VS Code
2. 按 `F5` 启动扩展开发主机
3. 在活动栏找到🧠图标

## 使用

### 浏览本地Skills
点击活动栏的🧠图标，展开"Local Skills"查看已安装的skills。

### 从GitHub安装Skill
1. 在"GitHub - Official"或"Community Skills"列表中右键点击skill
2. 选择"Install Skill"

### 搜索社区Skills
1. 点击"Community Skills"视图标题栏的🔍图标
2. 输入关键词搜索

### 创建新Skill
点击"Local Skills"视图标题栏的➕图标。

## 配置

| 设置 | 描述 | 默认值 |
|------|------|--------|
| `antigravity.skillsPath` | 自定义skills目录路径 | ~/.gemini/antigravity/skills |
| `antigravity.githubToken` | GitHub token（提高API限制） | - |
| `antigravity.minStars` | 社区skills最低Star数过滤 | 0 |
| `antigravity.showUnverifiedSkills` | 显示无SKILL.md的仓库 | false |

## 开发

```bash
npm install
npm run compile
# 按 F5 启动调试
```

## License

MIT
