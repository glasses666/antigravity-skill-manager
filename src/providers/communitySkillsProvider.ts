import * as vscode from 'vscode';
import { CommunitySkill, SkillFilter, SkillCategory } from '../types';
import { GitHubService } from '../services/githubService';

/**
 * Tree item for community skills
 */
export class CommunitySkillItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly skill?: CommunitySkill,
        public readonly isMessage?: boolean
    ) {
        super(label, collapsibleState);

        if (skill) {
            this.contextValue = 'communitySkill';
            this.tooltip = new vscode.MarkdownString(this.buildTooltip(skill));
            this.iconPath = skill.verified
                ? new vscode.ThemeIcon('verified-filled')
                : new vscode.ThemeIcon('package');
            this.description = this.buildDescription(skill);
        } else if (isMessage) {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }

    private buildTooltip(skill: CommunitySkill): string {
        const lines = [
            `**${skill.name}**`,
            '',
            skill.description || 'No description',
            '',
            `⭐ ${skill.stars} stars | 🍴 ${skill.forks} forks`,
            `Updated: ${new Date(skill.updatedAt).toLocaleDateString()}`
        ];

        if (skill.topics.length > 0) {
            lines.push('', `Topics: ${skill.topics.join(', ')}`);
        }

        return lines.join('\n');
    }

    private buildDescription(skill: CommunitySkill): string {
        const parts: string[] = [];
        if (skill.stars > 0) parts.push(`⭐${skill.stars}`);
        if (skill.category) parts.push(this.getCategoryIcon(skill.category));
        if (skill.verified) parts.push('✓');
        return parts.join(' ');
    }

    private getCategoryIcon(category: SkillCategory): string {
        const icons: Record<SkillCategory, string> = {
            development: '💻',
            design: '🎨',
            security: '🔒',
            document: '📄',
            testing: '🧪',
            automation: '⚙️',
            other: '📦'
        };
        return icons[category] || '📦';
    }
}

/**
 * Community skills provider with search and filter
 */
export class CommunitySkillsProvider implements vscode.TreeDataProvider<CommunitySkillItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CommunitySkillItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private githubService: GitHubService;
    private skills: CommunitySkill[] = [];
    private filteredSkills: CommunitySkill[] = [];
    private currentFilter: SkillFilter = {};
    private loading = false;
    private error: string | null = null;
    private searchQuery: string = '';

    // Curated community skills from awesome-claude-skills
    private curatedSkills = [
        { owner: 'obra', repo: 'superpowers', category: 'development' as SkillCategory },
        { owner: 'conorluddy', repo: 'ios-simulator-skill', category: 'testing' as SkillCategory },
        { owner: 'lackeyjb', repo: 'playwright-skill', category: 'testing' as SkillCategory },
        { owner: 'chrisvoncsefalvay', repo: 'claude-d3js-skill', category: 'design' as SkillCategory },
        { owner: 'alonw0', repo: 'web-asset-generator', category: 'design' as SkillCategory },
        { owner: 'trailofbits', repo: 'skills', category: 'security' as SkillCategory },
        { owner: 'K-Dense-AI', repo: 'claude-scientific-skills', category: 'other' as SkillCategory },
        { owner: 'jthack', repo: 'ffuf_claude_skill', category: 'security' as SkillCategory }
    ];

    constructor() {
        this.githubService = new GitHubService();
        this.loadCuratedSkills();
    }

    refresh(): void {
        this.skills = [];
        this.filteredSkills = [];
        this.error = null;
        this.loadCuratedSkills();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommunitySkillItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CommunitySkillItem): Promise<CommunitySkillItem[]> {
        if (this.loading) {
            return [new CommunitySkillItem('Loading community skills...', vscode.TreeItemCollapsibleState.None, undefined, true)];
        }

        if (this.error) {
            const item = new CommunitySkillItem(this.error, vscode.TreeItemCollapsibleState.None, undefined, true);
            item.iconPath = new vscode.ThemeIcon('error');
            return [item];
        }

        if (!element) {
            const displaySkills = this.filteredSkills.length > 0 ? this.filteredSkills : this.skills;

            if (displaySkills.length === 0) {
                return [new CommunitySkillItem(
                    this.searchQuery ? 'No matching skills found' : 'No community skills loaded',
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    true
                )];
            }

            return displaySkills.map(skill => new CommunitySkillItem(
                skill.name,
                vscode.TreeItemCollapsibleState.None,
                skill
            ));
        }

        return [];
    }

    private async loadCuratedSkills(): Promise<void> {
        this.loading = true;
        this._onDidChangeTreeData.fire();

        const loadedSkills: CommunitySkill[] = [];

        for (const curated of this.curatedSkills) {
            try {
                const repoInfo = await this.githubService.getRepoInfo(curated.owner, curated.repo);

                // Verify SKILL.md exists
                const verified = await this.githubService.hasSkillMd(curated.owner, curated.repo);

                loadedSkills.push({
                    name: repoInfo.name,
                    repoUrl: repoInfo.html_url,
                    description: repoInfo.description || '',
                    stars: repoInfo.stargazers_count,
                    forks: repoInfo.forks_count,
                    updatedAt: repoInfo.updated_at,
                    topics: repoInfo.topics || [],
                    verified,
                    category: curated.category
                });
            } catch (err) {
                console.error(`Failed to load ${curated.owner}/${curated.repo}:`, err);
            }
        }

        // Sort by stars
        this.skills = loadedSkills.sort((a, b) => b.stars - a.stars);
        this.applyFilter();
        this.loading = false;
        this._onDidChangeTreeData.fire();
    }

    async search(query: string): Promise<void> {
        this.searchQuery = query;
        this.loading = true;
        this._onDidChangeTreeData.fire();

        try {
            const results = await this.githubService.searchSkillRepos(query);

            const config = vscode.workspace.getConfiguration('antigravity');
            const minStars = config.get<number>('minStars') || 0;
            const showUnverified = config.get<boolean>('showUnverifiedSkills') || false;

            const searchSkills: CommunitySkill[] = [];

            for (const repo of results) {
                // Check if meets star requirement
                if (repo.stargazers_count < minStars) continue;

                // Check for SKILL.md
                const verified = await this.githubService.hasSkillMd(repo.owner.login, repo.name);

                if (!verified && !showUnverified) continue;

                searchSkills.push({
                    name: repo.name,
                    repoUrl: repo.html_url,
                    description: repo.description || '',
                    stars: repo.stargazers_count,
                    forks: repo.forks_count,
                    updatedAt: repo.updated_at,
                    topics: repo.topics || [],
                    verified,
                    category: this.inferCategory(repo.topics, repo.description)
                });
            }

            this.filteredSkills = searchSkills.sort((a, b) => b.stars - a.stars);
            this.error = null;
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Search failed';
            this.filteredSkills = [];
        } finally {
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    setFilter(filter: SkillFilter): void {
        this.currentFilter = filter;
        this.applyFilter();
        this._onDidChangeTreeData.fire();
    }

    clearFilter(): void {
        this.currentFilter = {};
        this.searchQuery = '';
        this.filteredSkills = [];
        this._onDidChangeTreeData.fire();
    }

    private applyFilter(): void {
        if (Object.keys(this.currentFilter).length === 0) {
            this.filteredSkills = [];
            return;
        }

        this.filteredSkills = this.skills.filter(skill => {
            // Category filter
            if (this.currentFilter.categories && this.currentFilter.categories.length > 0) {
                if (!skill.category || !this.currentFilter.categories.includes(skill.category)) {
                    return false;
                }
            }

            // Min stars filter
            if (this.currentFilter.minStars && skill.stars < this.currentFilter.minStars) {
                return false;
            }

            // Verified only filter
            if (this.currentFilter.verifiedOnly && !skill.verified) {
                return false;
            }

            // Keywords filter
            if (this.currentFilter.keywords && this.currentFilter.keywords.length > 0) {
                const text = `${skill.name} ${skill.description}`.toLowerCase();
                const hasKeyword = this.currentFilter.keywords.some(kw =>
                    text.includes(kw.toLowerCase())
                );
                if (!hasKeyword) return false;
            }

            // Updated within filter
            if (this.currentFilter.updatedWithin) {
                const now = new Date();
                const updated = new Date(skill.updatedAt);
                const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

                const maxDays: Record<string, number> = {
                    '1week': 7,
                    '1month': 30,
                    '3months': 90,
                    '1year': 365
                };

                if (daysDiff > maxDays[this.currentFilter.updatedWithin]) {
                    return false;
                }
            }

            return true;
        });
    }

    private inferCategory(topics: string[], description: string | null): SkillCategory {
        const text = [...topics, description || ''].join(' ').toLowerCase();

        if (text.includes('test') || text.includes('playwright') || text.includes('selenium')) {
            return 'testing';
        }
        if (text.includes('security') || text.includes('audit') || text.includes('fuzzing')) {
            return 'security';
        }
        if (text.includes('design') || text.includes('ui') || text.includes('css') || text.includes('visualization')) {
            return 'design';
        }
        if (text.includes('doc') || text.includes('markdown') || text.includes('pdf')) {
            return 'document';
        }
        if (text.includes('automation') || text.includes('workflow') || text.includes('ci')) {
            return 'automation';
        }
        if (text.includes('dev') || text.includes('code') || text.includes('programming')) {
            return 'development';
        }

        return 'other';
    }

    getSkillByName(name: string): CommunitySkill | undefined {
        return this.skills.find(s => s.name === name) ||
            this.filteredSkills.find(s => s.name === name);
    }

    getAllSkills(): CommunitySkill[] {
        return this.filteredSkills.length > 0 ? this.filteredSkills : this.skills;
    }
}
