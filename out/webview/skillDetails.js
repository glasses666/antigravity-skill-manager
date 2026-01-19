"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillDetailsPanel = void 0;
const vscode = __importStar(require("vscode"));
const githubService_1 = require("../services/githubService");
/**
 * Skill Details Panel - Shows skill info like VS Code extension page
 */
class SkillDetailsPanel {
    static async createOrShow(extensionUri, skill, skillsPath) {
        const column = vscode.ViewColumn.One;
        // If panel exists, update content
        if (SkillDetailsPanel.currentPanel) {
            SkillDetailsPanel.currentPanel._panel.reveal(column);
            await SkillDetailsPanel.currentPanel._update(skill);
            return;
        }
        // Create new panel
        const panel = vscode.window.createWebviewPanel('skillDetails', skill.name, column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        SkillDetailsPanel.currentPanel = new SkillDetailsPanel(panel, extensionUri, skill, skillsPath);
    }
    constructor(panel, extensionUri, skill, skillsPath) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._githubService = new githubService_1.GitHubService();
        this._skillsPath = skillsPath;
        // Set initial content
        this._update(skill);
        // Handle disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'install':
                    await this._installSkill(message.skill);
                    return;
                case 'openGitHub':
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                    return;
            }
        }, null, this._disposables);
    }
    async _installSkill(skill) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const destPath = path.join(this._skillsPath, skill.name);
        if (fs.existsSync(destPath)) {
            const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Skill "${skill.name}" exists. Overwrite?`
            });
            if (overwrite !== 'Yes')
                return;
            fs.rmSync(destPath, { recursive: true, force: true });
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${skill.name}...`,
            cancellable: false
        }, async () => {
            try {
                await this._githubService.cloneSkill(skill.repoUrl, destPath);
                vscode.window.showInformationMessage(`✅ ${skill.name} installed!`);
                vscode.commands.executeCommand('antigravity.refreshSkills');
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed: ${err}`);
            }
        });
    }
    async _update(skill) {
        this._panel.title = skill.name;
        // Get README content - try multiple file names
        let readmeContent = '';
        const match = skill.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            const [, owner, repo] = match;
            const repoName = repo.replace('.git', '');
            // Try different README file names
            const readmeFiles = ['README.md', 'readme.md', 'Readme.md', 'README.MD', 'SKILL.md'];
            for (const filename of readmeFiles) {
                try {
                    readmeContent = await this._githubService.getRawContent(owner, repoName, filename);
                    if (readmeContent && readmeContent.trim().length > 0) {
                        break;
                    }
                }
                catch {
                    continue;
                }
            }
        }
        // If no README found, show a friendly message
        if (!readmeContent || readmeContent.trim().length === 0) {
            readmeContent = `# ${skill.name}\n\n${skill.description || 'No description available.'}\n\n---\n\n*No README file found in this repository. Click "View on GitHub" to see more details.*`;
        }
        this._panel.webview.html = this._getHtml(skill, readmeContent);
    }
    _getHtml(skill, readmeContent) {
        // Simple markdown to HTML conversion
        const readmeHtml = this._markdownToHtml(readmeContent);
        const categoryIcons = {
            development: '💻',
            design: '🎨',
            security: '🔒',
            document: '📄',
            testing: '🧪',
            automation: '⚙️',
            other: '📦'
        };
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${skill.name}</title>
    <style>
        :root {
            --vscode-font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        }
        
        * { box-sizing: border-box; }
        
        body {
            font-family: var(--vscode-font);
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            line-height: 1.6;
        }
        
        .header {
            padding: 24px 32px;
            border-bottom: 1px solid var(--vscode-widget-border);
            background: var(--vscode-sideBar-background);
        }
        
        .header-content {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        
        .skill-icon {
            width: 80px;
            height: 80px;
            background: var(--vscode-button-background);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
        }
        
        .skill-info {
            flex: 1;
        }
        
        .skill-name {
            font-size: 28px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }
        
        .skill-meta {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            margin-bottom: 12px;
        }
        
        .skill-meta span {
            margin-right: 16px;
        }
        
        .skill-description {
            font-size: 14px;
            color: var(--vscode-foreground);
            margin-bottom: 16px;
        }
        
        .action-buttons {
            display: flex;
            gap: 10px;
        }
        
        button {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-top: 12px;
        }
        
        .tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }
        
        .content {
            padding: 24px 32px;
            max-width: 900px;
        }
        
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-widget-border);
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: var(--vscode-descriptionForeground);
        }
        
        .tab.active {
            color: var(--vscode-foreground);
            border-bottom-color: var(--vscode-focusBorder);
        }
        
        .readme {
            font-size: 14px;
        }
        
        .readme h1 { font-size: 24px; margin: 24px 0 12px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 8px; }
        .readme h2 { font-size: 20px; margin: 20px 0 10px; }
        .readme h3 { font-size: 16px; margin: 16px 0 8px; }
        .readme p { margin: 8px 0; }
        .readme pre { 
            background: var(--vscode-textCodeBlock-background); 
            padding: 12px; 
            border-radius: 6px; 
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 13px;
        }
        .readme code { 
            background: var(--vscode-textCodeBlock-background); 
            padding: 2px 6px; 
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
        }
        .readme pre code { background: none; padding: 0; }
        .readme ul, .readme ol { padding-left: 24px; }
        .readme li { margin: 4px 0; }
        .readme a { color: var(--vscode-textLink-foreground); }
        .readme blockquote {
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            margin: 12px 0;
            padding: 8px 16px;
            background: var(--vscode-textBlockQuote-background);
        }
        .readme img { max-width: 100%; border-radius: 6px; }
        .readme table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        .readme th, .readme td { border: 1px solid var(--vscode-widget-border); padding: 8px; text-align: left; }
        .readme th { background: var(--vscode-sideBar-background); }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="skill-icon">${categoryIcons[skill.category || 'other'] || '📦'}</div>
            <div class="skill-info">
                <h1 class="skill-name">${skill.name}</h1>
                <div class="skill-meta">
                    <span>⭐ ${skill.stars.toLocaleString()} stars</span>
                    <span>🍴 ${skill.forks} forks</span>
                    <span>📅 Updated ${new Date(skill.updatedAt).toLocaleDateString()}</span>
                    ${skill.verified ? '<span>✅ Verified</span>' : ''}
                </div>
                <p class="skill-description">${skill.description || 'No description'}</p>
                <div class="action-buttons">
                    <button class="btn-primary" onclick="installSkill()">
                        <span>⬇️</span> Install
                    </button>
                    <button class="btn-secondary" onclick="openGitHub()">
                        <span>🔗</span> View on GitHub
                    </button>
                </div>
                ${skill.topics.length > 0 ? `
                <div class="tags">
                    ${skill.topics.slice(0, 8).map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
                ` : ''}
            </div>
        </div>
    </div>
    
    <div class="content">
        <div class="tabs">
            <div class="tab active">README</div>
        </div>
        <div class="readme">
            ${readmeHtml}
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const skill = ${JSON.stringify(skill)};
        
        function installSkill() {
            vscode.postMessage({ command: 'install', skill });
        }
        
        function openGitHub() {
            vscode.postMessage({ command: 'openGitHub', url: skill.repoUrl });
        }
    </script>
</body>
</html>`;
    }
    _markdownToHtml(md) {
        // Simple markdown to HTML conversion
        let html = md
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            // Blockquotes
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            // Unordered lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        // Wrap lists
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        // Clean up multiple ul tags
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        return `<p>${html}</p>`;
    }
    dispose() {
        SkillDetailsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d)
                d.dispose();
        }
    }
}
exports.SkillDetailsPanel = SkillDetailsPanel;
//# sourceMappingURL=skillDetails.js.map