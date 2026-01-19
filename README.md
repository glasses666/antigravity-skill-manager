# Antigravity Skill Manager

[English](README.md) | [中文](README_zh-CN.md)

Antigravity Skill Manager is a VS Code extension designed to supercharge your AI coding assistant. It allows you to discover, manage, and install "Skills" (specialized instructions and tools) for Claude Code and Antigravity.

![Demo](https://raw.githubusercontent.com/glasses666/antigravity-skill-manager/main/media/demo.png)

## Features

### 🏪 Skill Store
Browse a vast collection of community-created skills directly within VS Code.
- **Rich UI**: Experience a marketplace-like interface with icons, ratings, and authors.
- **Search**: Instantly search GitHub for skills matching your needs.
- **One-Click Install**: Install skills seamlessly without leaving the editor.
- **GitHub Auth**: Built-in GitHub authentication to bypass API rate limits.

### 📄 Skill Details
View detailed information about any skill before installing.
- **README Rendering**: Automatically renders the skill's `README.md` or `SKILL.md` with full Markdown support (tables, images, links).
- **Metadata**: Check stars, forks, verification status, and last update time.
- **Image Support**: Images in READMEs are automatically processed to display correctly.

### ☁️ GitHub Integration
- **Official Skills**: Browse curated skills from `anthropics/skills`.
- **Community Discovery**: Automatically discovers skills from the community using `SKILL.md` markers.
- **Verified Only**: Filters repositories to ensure valid skills with documentation are shown.

### 📁 Local Management
- Manage your installed skills in `~/.gemini/antigravity/skills` (or custom path).
- Create new skills quickly with local templates.
- Edit existing skills directly in VS Code.

## Installation

1. Open this project in VS Code.
2. Run `npm install` to install dependencies.
3. Press `F5` to start the extension in a new Debug window.

## Usage

1. **Open the Manager**: Click the 🧠 icon in the Activity Bar.
2. **Browse Skills**:
   - **Local Skills**: Installed skills on your machine.
   - **GitHub - Official**: Curated skills from Anthropic.
   - **Skill Store**: Searchable community marketplace.
3. **Install**: Click "Install" on any skill card or right-click a tree item.
4. **View Details**: Click on any skill card to open the Details Webview.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `antigravity.skillsPath` | Custom directory for installing skills | `~/.gemini/antigravity/skills` |
| `antigravity.githubToken` | (Optional) Personal Access Token for GitHub API | - |
| `antigravity.minStars` | Minimum stars filter for community skills | 0 |
| `antigravity.showUnverifiedSkills` | Show repositories without `SKILL.md` | `false` |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
