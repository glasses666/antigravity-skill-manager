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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalSkillsWebview = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const githubService_1 = require("../services/githubService");
/**
 * Local Skills Management Webview
 */
class LocalSkillsWebview {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._skills = [];
        const config = vscode.workspace.getConfiguration('antigravity');
        const customPath = config.get('skillsPath');
        this._skillsPath = customPath?.trim() || path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
        this._githubService = new githubService_1.GitHubService();
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refresh':
                    await this.refresh();
                    break;
                case 'edit':
                    await this._editSkill(message.skillPath);
                    break;
                case 'openFolder':
                    await this._openFolder(message.skillPath);
                    break;
                case 'delete':
                    await this._deleteSkill(message.skillName, message.skillPath);
                    break;
                case 'checkUpdate':
                    await this._checkUpdate(message.skill);
                    break;
                case 'update':
                    await this._updateSkill(message.skill);
                    break;
            }
        });
        this.refresh();
    }
    async refresh() {
        await this._loadSkills();
        this._updateView();
    }
    async _loadSkills() {
        this._skills = [];
        if (!fs.existsSync(this._skillsPath)) {
            return;
        }
        const entries = fs.readdirSync(this._skillsPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(this._skillsPath, entry.name);
                const skillMdPath = path.join(skillPath, 'SKILL.md');
                const sourcePath = path.join(skillPath, '.source.json');
                if (fs.existsSync(skillMdPath)) {
                    let description = '';
                    try {
                        const content = fs.readFileSync(skillMdPath, 'utf-8');
                        const parsed = (0, gray_matter_1.default)(content);
                        description = parsed.data.description || '';
                    }
                    catch { }
                    let sourceInfo = {};
                    if (fs.existsSync(sourcePath)) {
                        try {
                            sourceInfo = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
                        }
                        catch { }
                    }
                    // Count files
                    const files = this._countFiles(skillPath);
                    this._skills.push({
                        name: entry.name,
                        path: skillPath,
                        description,
                        hasSource: !!sourceInfo.url,
                        sourceUrl: sourceInfo.url,
                        sourceCommit: sourceInfo.commit,
                        files
                    });
                }
            }
        }
    }
    _countFiles(dir) {
        const files = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue;
                if (entry.isDirectory()) {
                    files.push(...this._countFiles(path.join(dir, entry.name)));
                }
                else {
                    files.push(entry.name);
                }
            }
        }
        catch { }
        return files;
    }
    async _editSkill(skillPath) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
            const doc = await vscode.workspace.openTextDocument(skillMdPath);
            await vscode.window.showTextDocument(doc);
        }
    }
    async _openFolder(skillPath) {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(skillPath));
    }
    async _deleteSkill(skillName, skillPath) {
        const confirm = await vscode.window.showWarningMessage(`Delete skill "${skillName}"? This cannot be undone.`, { modal: true }, 'Delete');
        if (confirm === 'Delete') {
            try {
                fs.rmSync(skillPath, { recursive: true, force: true });
                vscode.window.showInformationMessage(`Skill "${skillName}" deleted.`);
                await this.refresh();
                vscode.commands.executeCommand('antigravity.refreshSkills');
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed to delete: ${err}`);
            }
        }
    }
    async _checkUpdate(skill) {
        if (!skill.sourceUrl) {
            vscode.window.showInformationMessage('This skill has no remote source info.');
            return;
        }
        try {
            const match = skill.sourceUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match)
                return;
            const [, owner, repo] = match;
            const repoInfo = await this._githubService.getRepoInfo(owner, repo.replace('.git', ''));
            vscode.window.showInformationMessage(`Latest update: ${new Date(repoInfo.updated_at).toLocaleDateString()}`, 'Update Now').then(selection => {
                if (selection === 'Update Now') {
                    this._updateSkill(skill);
                }
            });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to check update: ${err}`);
        }
    }
    async _updateSkill(skill) {
        if (!skill.sourceUrl) {
            vscode.window.showErrorMessage('Cannot update: no source URL.');
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Updating ${skill.name}...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Backup old version
                const backupPath = `${skill.path}.backup`;
                if (fs.existsSync(backupPath)) {
                    fs.rmSync(backupPath, { recursive: true, force: true });
                }
                fs.renameSync(skill.path, backupPath);
                // Re-download
                progress.report({ message: 'Downloading latest version...' });
                await this._githubService.cloneSkill(skill.sourceUrl, skill.path);
                // Restore source info
                const sourceInfo = {
                    url: skill.sourceUrl,
                    updatedAt: new Date().toISOString()
                };
                fs.writeFileSync(path.join(skill.path, '.source.json'), JSON.stringify(sourceInfo, null, 2));
                // Remove backup
                fs.rmSync(backupPath, { recursive: true, force: true });
                vscode.window.showInformationMessage(`✅ ${skill.name} updated!`);
                await this.refresh();
                vscode.commands.executeCommand('antigravity.refreshSkills');
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed to update: ${err}`);
            }
        });
    }
    _updateView() {
        if (!this._view)
            return;
        this._view.webview.html = this._getHtml();
    }
    _getHtml() {
        const skillCards = this._skills.map(skill => `
            <div class="skill-card">
                <div class="skill-header">
                    <span class="skill-name">${skill.name}</span>
                    ${skill.hasSource ? '<span class="badge">Remote</span>' : '<span class="badge local">Local</span>'}
                </div>
                <div class="skill-desc">${skill.description || 'No description'}</div>
                <div class="skill-meta">${skill.files.length} files</div>
                <div class="skill-actions">
                    <button onclick="editSkill('${skill.path.replace(/\\/g, '\\\\')}')">✏️ Edit</button>
                    <button onclick="openFolder('${skill.path.replace(/\\/g, '\\\\')}')">📂 Open</button>
                    ${skill.hasSource ? `<button onclick="checkUpdate(${JSON.stringify(skill).replace(/"/g, '&quot;')})">🔄 Update</button>` : ''}
                    <button class="danger" onclick="deleteSkill('${skill.name}', '${skill.path.replace(/\\/g, '\\\\')}')">🗑️</button>
                </div>
            </div>
        `).join('');
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .header h3 {
            margin: 0;
        }
        .refresh-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 5px 12px;
            cursor: pointer;
            border-radius: 3px;
        }
        .skill-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
        }
        .skill-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .skill-name {
            font-weight: bold;
            font-size: 14px;
        }
        .badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .badge.local {
            background: var(--vscode-editorInfo-foreground);
        }
        .skill-desc {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-bottom: 8px;
        }
        .skill-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .skill-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .skill-actions button {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            border-radius: 3px;
        }
        .skill-actions button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .skill-actions button.danger {
            background: var(--vscode-inputValidation-errorBackground);
        }
        .empty {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>📦 Installed Skills (${this._skills.length})</h3>
        <button class="refresh-btn" onclick="refresh()">🔄 Refresh</button>
    </div>
    ${this._skills.length ? skillCards : '<div class="empty">No skills installed yet.</div>'}
    <script>
        const vscode = acquireVsCodeApi();
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function editSkill(skillPath) {
            vscode.postMessage({ command: 'edit', skillPath });
        }
        
        function openFolder(skillPath) {
            vscode.postMessage({ command: 'openFolder', skillPath });
        }
        
        function deleteSkill(skillName, skillPath) {
            vscode.postMessage({ command: 'delete', skillName, skillPath });
        }
        
        function checkUpdate(skill) {
            vscode.postMessage({ command: 'checkUpdate', skill });
        }
    </script>
</body>
</html>`;
    }
}
exports.LocalSkillsWebview = LocalSkillsWebview;
LocalSkillsWebview.viewType = 'antigravity.localSkillsWebview';
//# sourceMappingURL=localSkillsWebview.js.map