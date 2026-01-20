import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import matter from 'gray-matter';
import { GitHubService } from '../services/githubService';

interface LocalSkillInfo {
    name: string;
    path: string;
    description: string;
    hasSource: boolean;
    sourceUrl?: string;
    sourceCommit?: string;
    files: string[];
}

/**
 * Local Skills Management Webview
 */
export class LocalSkillsWebview implements vscode.WebviewViewProvider {
    public static readonly viewType = 'antigravity.localSkillsWebview';

    private _view?: vscode.WebviewView;
    private _skills: LocalSkillInfo[] = [];
    private _skillsPath: string;
    private _githubService: GitHubService;

    constructor(private readonly _extensionUri: vscode.Uri) {
        const config = vscode.workspace.getConfiguration('antigravity');
        const customPath = config.get<string>('skillsPath');
        this._skillsPath = customPath?.trim() || path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
        this._githubService = new GitHubService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(async message => {
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

    public async refresh() {
        await this._loadSkills();
        this._updateView();
    }

    private async _loadSkills() {
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
                        const parsed = matter(content);
                        description = parsed.data.description || '';
                    } catch { }

                    let sourceInfo: { url?: string; commit?: string } = {};
                    if (fs.existsSync(sourcePath)) {
                        try {
                            sourceInfo = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
                        } catch { }
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

    private _countFiles(dir: string): string[] {
        const files: string[] = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                if (entry.isDirectory()) {
                    files.push(...this._countFiles(path.join(dir, entry.name)));
                } else {
                    files.push(entry.name);
                }
            }
        } catch { }
        return files;
    }

    private async _editSkill(skillPath: string) {
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
            const doc = await vscode.workspace.openTextDocument(skillMdPath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private async _openFolder(skillPath: string) {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(skillPath));
    }

    private async _deleteSkill(skillName: string, skillPath: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Delete skill "${skillName}"? This cannot be undone.`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                fs.rmSync(skillPath, { recursive: true, force: true });
                vscode.window.showInformationMessage(`Skill "${skillName}" deleted.`);
                await this.refresh();
                vscode.commands.executeCommand('antigravity.refreshSkills');
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to delete: ${err}`);
            }
        }
    }

    private async _checkUpdate(skill: LocalSkillInfo) {
        if (!skill.sourceUrl) {
            vscode.window.showInformationMessage('This skill has no remote source info.');
            return;
        }

        try {
            const match = skill.sourceUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) return;

            const [, owner, repo] = match;
            const repoInfo = await this._githubService.getRepoInfo(owner, repo.replace('.git', ''));

            vscode.window.showInformationMessage(
                `Latest update: ${new Date(repoInfo.updated_at).toLocaleDateString()}`,
                'Update Now'
            ).then(selection => {
                if (selection === 'Update Now') {
                    this._updateSkill(skill);
                }
            });
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to check update: ${err}`);
        }
    }

    private async _updateSkill(skill: LocalSkillInfo) {
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
                await this._githubService.cloneSkill(skill.sourceUrl!, skill.path);

                // Restore source info
                const sourceInfo = {
                    url: skill.sourceUrl,
                    updatedAt: new Date().toISOString()
                };
                fs.writeFileSync(
                    path.join(skill.path, '.source.json'),
                    JSON.stringify(sourceInfo, null, 2)
                );

                // Remove backup
                fs.rmSync(backupPath, { recursive: true, force: true });

                vscode.window.showInformationMessage(`✅ ${skill.name} updated!`);
                await this.refresh();
                vscode.commands.executeCommand('antigravity.refreshSkills');
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to update: ${err}`);
            }
        });
    }

    private _updateView() {
        if (!this._view) return;
        this._view.webview.html = this._getHtml();
    }

    private _getHtml(): string {
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
