import * as vscode from 'vscode';
import { GitHubSkill, GitHubRepoContent } from '../types';
import { GitHubService } from '../services/githubService';

/**
 * Tree item for GitHub skills
 */
export class GitHubSkillItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly skill?: GitHubSkill,
        public readonly isCategory?: boolean
    ) {
        super(label, collapsibleState);

        if (isCategory) {
            this.contextValue = 'githubCategory';
            this.iconPath = new vscode.ThemeIcon('folder-library');
        } else if (skill) {
            this.contextValue = 'githubSkill';
            this.tooltip = skill.description;
            this.iconPath = skill.verified
                ? new vscode.ThemeIcon('verified')
                : new vscode.ThemeIcon('package');
            this.description = skill.stars !== undefined ? `⭐ ${skill.stars}` : '';

            // Click to open details - convert to CommunitySkill format
            this.command = {
                command: 'antigravity.showDetails',
                title: 'View Details',
                arguments: [{
                    skill: {
                        name: skill.name,
                        repoUrl: skill.url || `https://github.com/${skill.repoOwner}/${skill.repoName}`,
                        description: skill.description || '',
                        stars: skill.stars || 0,
                        forks: 0,
                        updatedAt: new Date().toISOString(),
                        topics: [],
                        verified: skill.verified || true,
                        category: 'development'
                    }
                }]
            };
        }
    }
}

/**
 * GitHub official skills provider (anthropics/skills)
 */
export class GitHubSkillsProvider implements vscode.TreeDataProvider<GitHubSkillItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GitHubSkillItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private githubService: GitHubService;
    private skills: GitHubSkill[] = [];
    private loading = false;
    private error: string | null = null;

    // Skill categories from anthropics/skills
    private categories = [
        { name: 'Creative & Design', path: 'skills', filter: ['art-styles', 'branding', 'music'] },
        { name: 'Development', path: 'skills', filter: ['mcp-server-generator', 'webapp-testing'] },
        { name: 'Document Skills', path: 'skills', filter: ['docx', 'pdf', 'pptx', 'xlsx'] },
        { name: 'Communication', path: 'skills', filter: ['email', 'comms'] }
    ];

    constructor() {
        this.githubService = new GitHubService();
        this.loadSkills();
    }

    refresh(): void {
        this.skills = [];
        this.error = null;
        this.loadSkills();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GitHubSkillItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GitHubSkillItem): Promise<GitHubSkillItem[]> {
        if (this.loading) {
            return [new GitHubSkillItem('Loading...', vscode.TreeItemCollapsibleState.None)];
        }

        if (this.error) {
            const item = new GitHubSkillItem(this.error, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon('error');
            return [item];
        }

        if (!element) {
            // Root level - show all skills or message
            if (this.skills.length === 0) {
                const item = new GitHubSkillItem('No skills loaded', vscode.TreeItemCollapsibleState.None);
                item.iconPath = new vscode.ThemeIcon('info');
                return [item];
            }
            return this.skills.map(skill => new GitHubSkillItem(
                skill.name,
                vscode.TreeItemCollapsibleState.None,
                skill
            ));
        }

        return [];
    }

    private async loadSkills(): Promise<void> {
        this.loading = true;
        this._onDidChangeTreeData.fire();

        try {
            const contents = await this.githubService.getRepoContents('anthropics', 'skills', 'skills');

            this.skills = contents
                .filter(item => item.type === 'dir')
                .map(item => ({
                    name: item.name,
                    repoOwner: 'anthropics',
                    repoName: 'skills',
                    path: item.path,
                    description: this.getSkillDescription(item.name),
                    url: `https://github.com/anthropics/skills/tree/main/${item.path}`,
                    verified: true
                }));

            this.error = null;
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Failed to load skills';
            this.skills = [];
        } finally {
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    private getSkillDescription(name: string): string {
        // Known skill descriptions
        const descriptions: Record<string, string> = {
            'art-styles': 'Generate images in specific artistic styles',
            'docx': 'Create and edit Word documents',
            'pdf': 'Create PDF documents',
            'pptx': 'Create PowerPoint presentations',
            'xlsx': 'Create Excel spreadsheets',
            'mcp-server-generator': 'Generate MCP server code',
            'webapp-testing': 'Test web applications',
            'email': 'Compose professional emails',
            'branding': 'Create brand guidelines',
            'music': 'Generate music compositions'
        };
        return descriptions[name] || `${name} skill from anthropics/skills`;
    }

    getSkillByName(name: string): GitHubSkill | undefined {
        return this.skills.find(s => s.name === name);
    }
}
