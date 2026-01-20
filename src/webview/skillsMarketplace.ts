import * as vscode from 'vscode';
import { CommunitySkill, GitHubSkill } from '../types';
import { GitHubService } from '../services/githubService';

/**
 * Skills Marketplace - VS Code Extension Store style view
 */
export class SkillsMarketplace implements vscode.WebviewViewProvider {
    public static readonly viewType = 'skillsMarketplace';

    private _view?: vscode.WebviewView;
    private _skills: CommunitySkill[] = [];
    private _loading = false;
    private _error: string | null = null;
    private _githubService: GitHubService;
    private _skillsPath: string;
    private _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri, skillsPath: string) {
        this._extensionUri = extensionUri;
        this._skillsPath = skillsPath;
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

        webviewView.webview.html = this._getHtml();

        // Handle messages
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'install':
                    await this._installSkill(message.skill);
                    break;
                case 'showDetails':
                    await this._showDetails(message.skill);
                    break;
                case 'search':
                    await this._search(message.query);
                    break;
                case 'refresh':
                    await this.refresh();
                    break;
                case 'login':
                    await this._login();
                    break;
            }
        });

        // Load skills
        this.refresh();
    }

    public async refresh() {
        this._loading = true;
        this._error = null;
        this._updateView();

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning Community Skills...',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Fetching repositories...' });
                const repos = await this._githubService.discoverSkillRepos();

                // Filter repos that have README.md or SKILL.md
                const validSkills: CommunitySkill[] = [];
                const total = repos.length;

                for (let i = 0; i < repos.length; i++) {
                    const repo = repos[i];
                    progress.report({
                        message: `Verifying ${repo.name} (${i + 1}/${total})`,
                        increment: 100 / total
                    });

                    const hasReadme = await this._hasReadmeOrSkillMd(repo.owner?.login || '', repo.name);
                    if (hasReadme) {
                        validSkills.push({
                            name: repo.name,
                            repoUrl: repo.html_url,
                            description: repo.description || '',
                            stars: repo.stargazers_count,
                            forks: repo.forks_count,
                            updatedAt: repo.updated_at,
                            topics: repo.topics || [],
                            verified: true,
                            category: this._inferCategory(repo.topics, repo.description),
                            owner: repo.owner?.login || ''
                        } as CommunitySkill & { owner: string });
                    }
                }

                this._skills = validSkills;
                this._error = null;
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('403') || msg.includes('rate limit')) {
                this._error = 'rate_limit';
            } else {
                this._error = msg;
            }
            this._skills = [];
        }

        this._loading = false;
        this._updateView();
    }

    private async _hasReadmeOrSkillMd(owner: string, repo: string): Promise<boolean> {
        if (!owner || !repo) return false;

        const files = ['README.md', 'readme.md', 'SKILL.md'];
        for (const file of files) {
            try {
                const content = await this._githubService.getRawContent(owner, repo, file);
                if (content && content.trim().length > 50) {
                    return true;
                }
            } catch {
                continue;
            }
        }
        return false;
    }

    private async _search(query: string) {
        if (!query.trim()) {
            await this.refresh();
            return;
        }

        this._loading = true;
        this._updateView();

        try {
            const repos = await this._githubService.searchSkillRepos(query);

            this._skills = repos.map(repo => ({
                name: repo.name,
                repoUrl: repo.html_url,
                description: repo.description || '',
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                updatedAt: repo.updated_at,
                topics: repo.topics || [],
                verified: true,
                category: this._inferCategory(repo.topics, repo.description),
                owner: repo.owner?.login || ''
            }));

            this._error = null;
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
        }

        this._loading = false;
        this._updateView();
    }

    private async _login() {
        const success = await this._githubService.login();
        if (success) {
            await this.refresh();
        }
    }

    private async _installSkill(skill: CommunitySkill & { isOfficialSkill?: boolean; skillPath?: string; repoOwner?: string; repoName?: string }) {
        const fs = await import('fs');
        const path = await import('path');

        const destPath = path.join(this._skillsPath, skill.name);

        if (fs.existsSync(destPath)) {
            const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Skill "${skill.name}" exists. Overwrite?`
            });
            if (overwrite !== 'Yes') return;
            fs.rmSync(destPath, { recursive: true, force: true });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${skill.name}...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Check if this is an official skill with a specific path
                if (skill.isOfficialSkill && skill.skillPath && skill.repoOwner && skill.repoName) {
                    // Download only the specific skill subdirectory
                    await this._githubService.downloadSkill(
                        skill.repoOwner,
                        skill.repoName,
                        skill.skillPath,
                        destPath,
                        (msg, increment) => progress.report({ message: msg, increment })
                    );
                } else {
                    // Clone entire repo for community skills
                    progress.report({ message: 'Cloning repository...' });
                    await this._githubService.cloneSkill(skill.repoUrl, destPath);
                }

                // Save source info for future updates
                const fs = await import('fs');
                const sourceInfo = {
                    url: skill.repoUrl,
                    installedAt: new Date().toISOString(),
                    isOfficialSkill: skill.isOfficialSkill || false
                };
                fs.writeFileSync(
                    require('path').join(destPath, '.source.json'),
                    JSON.stringify(sourceInfo, null, 2)
                );

                vscode.window.showInformationMessage(`✅ ${skill.name} installed!`);
                vscode.commands.executeCommand('antigravity.refreshSkills');
            } catch (err) {
                vscode.window.showErrorMessage(`Failed: ${err}`);
            }
        });
    }

    private async _showDetails(skill: CommunitySkill) {
        const { SkillDetailsPanel } = await import('./skillDetails');
        SkillDetailsPanel.createOrShow(this._extensionUri, skill, this._skillsPath);
    }

    private _inferCategory(topics: string[], description: string | null): 'development' | 'testing' | 'security' | 'design' | 'document' | 'automation' | 'other' {
        const text = [...topics, description || ''].join(' ').toLowerCase();
        if (text.includes('test') || text.includes('playwright')) return 'testing';
        if (text.includes('security') || text.includes('audit')) return 'security';
        if (text.includes('design') || text.includes('ui')) return 'design';
        if (text.includes('doc') || text.includes('markdown')) return 'document';
        if (text.includes('automation') || text.includes('workflow')) return 'automation';
        return 'development';
    }

    private _updateView() {
        if (this._view) {
            this._view.webview.html = this._getHtml();
        }
    }

    private _getHtml(): string {
        const categoryIcons: Record<string, string> = {
            development: '💻',
            design: '🎨',
            security: '🔒',
            document: '📄',
            testing: '🧪',
            automation: '⚙️',
            other: '📦'
        };

        const skillsHtml = this._skills.map(skill => `
            <div class="skill-item" onclick="showDetails(${JSON.stringify(skill).replace(/"/g, '&quot;')})">
                <div class="skill-icon">${categoryIcons[skill.category || 'other'] || '📦'}</div>
                <div class="skill-content">
                    <div class="skill-header">
                        <span class="skill-name">${skill.name}</span>
                        <span class="skill-meta">⭐ ${this._formatNumber(skill.stars)}</span>
                    </div>
                    <div class="skill-desc">${this._truncate(skill.description, 80)}</div>
                    <div class="skill-author">${(skill as any).owner || 'Unknown'}</div>
                </div>
                <button class="install-btn" onclick="event.stopPropagation(); install(${JSON.stringify(skill).replace(/"/g, '&quot;')})">安装</button>
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            font-size: 13px;
        }
        
        .header {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            position: sticky;
            top: 0;
            background: var(--vscode-sideBar-background);
            z-index: 10;
        }
        
        .search-box {
            display: flex;
            gap: 6px;
        }
        
        .search-input {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 12px;
        }
        
        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .icon-btn {
            padding: 6px 8px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .icon-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .info-bar {
            padding: 8px 12px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .info-bar a {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
        }
        
        .skills-list {
            padding: 8px 0;
        }
        
        .skill-item {
            display: flex;
            align-items: flex-start;
            padding: 10px 12px;
            cursor: pointer;
            gap: 10px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .skill-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .skill-icon {
            width: 42px;
            height: 42px;
            background: var(--vscode-button-secondaryBackground);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
        }
        
        .skill-content {
            flex: 1;
            min-width: 0;
        }
        
        .skill-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 2px;
        }
        
        .skill-name {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .skill-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .skill-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .skill-author {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .install-btn {
            padding: 4px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
        }
        
        .install-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .loading, .error, .empty {
            padding: 40px 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
        
        .error-btn {
            margin-top: 12px;
            padding: 6px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="search-box">
            <input type="text" class="search-input" id="searchInput" placeholder="Search skills..." onkeydown="if(event.key==='Enter')search()">
            <button class="icon-btn" onclick="search()" title="Search">🔍</button>
            <button class="icon-btn" onclick="refresh()" title="Refresh">🔄</button>
            <button class="icon-btn" onclick="login()" title="Sign in to GitHub">🔓</button>
        </div>
    </div>
    
    ${this._loading ? `
        <div class="loading">
            <div>⏳ Loading skills...</div>
        </div>
    ` : this._error === 'rate_limit' ? `
        <div class="error">
            <div>⚠️ GitHub API limit reached</div>
            <button class="error-btn" onclick="login()">🔓 Sign in to GitHub</button>
        </div>
    ` : this._error ? `
        <div class="error">
            <div>❌ ${this._error}</div>
            <button class="error-btn" onclick="refresh()">Retry</button>
        </div>
    ` : this._skills.length === 0 ? `
        <div class="empty">
            <div>No skills found</div>
        </div>
    ` : `
        <div class="info-bar">
            Found ${this._skills.length} skills
        </div>
        <div class="skills-list">
            ${skillsHtml}
        </div>
    `}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function search() {
            const query = document.getElementById('searchInput').value;
            vscode.postMessage({ command: 'search', query });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function login() {
            vscode.postMessage({ command: 'login' });
        }
        
        function install(skill) {
            vscode.postMessage({ command: 'install', skill });
        }
        
        function showDetails(skill) {
            vscode.postMessage({ command: 'showDetails', skill });
        }
    </script>
</body>
</html>`;
    }

    private _formatNumber(num: number): string {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    private _truncate(str: string, len: number): string {
        if (str.length <= len) return str;
        return str.substring(0, len) + '...';
    }
}
