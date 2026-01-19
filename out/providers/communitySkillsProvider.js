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
exports.CommunitySkillsProvider = exports.CommunitySkillItem = void 0;
const vscode = __importStar(require("vscode"));
const githubService_1 = require("../services/githubService");
/**
 * Tree item for community skills
 */
class CommunitySkillItem extends vscode.TreeItem {
    constructor(label, collapsibleState, skill, isMessage) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.skill = skill;
        this.isMessage = isMessage;
        if (skill) {
            this.contextValue = 'communitySkill';
            this.tooltip = new vscode.MarkdownString(this.buildTooltip(skill));
            this.iconPath = skill.verified
                ? new vscode.ThemeIcon('verified-filled')
                : new vscode.ThemeIcon('package');
            this.description = this.buildDescription(skill);
        }
        else if (isMessage) {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
    buildTooltip(skill) {
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
    buildDescription(skill) {
        const parts = [];
        if (skill.stars > 0)
            parts.push(`⭐${skill.stars}`);
        if (skill.category)
            parts.push(this.getCategoryIcon(skill.category));
        if (skill.verified)
            parts.push('✓');
        return parts.join(' ');
    }
    getCategoryIcon(category) {
        const icons = {
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
exports.CommunitySkillItem = CommunitySkillItem;
/**
 * Community skills provider with search and filter
 */
class CommunitySkillsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.skills = [];
        this.filteredSkills = [];
        this.currentFilter = {};
        this.loading = false;
        this.error = null;
        this.searchQuery = '';
        // Curated community skills from awesome-claude-skills and GitHub search
        this.curatedSkills = [
            // Development & Coding
            { owner: 'obra', repo: 'superpowers', category: 'development', desc: 'Battle-tested skills library with 20+ skills' },
            // Testing
            { owner: 'conorluddy', repo: 'ios-simulator-skill', category: 'testing', desc: 'iOS Simulator automation' },
            { owner: 'lackeyjb', repo: 'playwright-skill', category: 'testing', desc: 'Playwright browser testing' },
            // Design & Visualization
            { owner: 'chrisvoncsefalvay', repo: 'claude-d3js-skill', category: 'design', desc: 'D3.js data visualization' },
            { owner: 'alonw0', repo: 'web-asset-generator', category: 'design', desc: 'Generate web assets and icons' },
            // Security
            { owner: 'trailofbits', repo: 'skills', category: 'security', desc: 'Security auditing skills' },
            { owner: 'jthack', repo: 'ffuf_claude_skill', category: 'security', desc: 'Web fuzzing with ffuf' },
            // Scientific & Data
            { owner: 'K-Dense-AI', repo: 'claude-scientific-skills', category: 'other', desc: 'Scientific computing skills' },
            // More from awesome-claude-skills
            { owner: 'obra', repo: 'superpowers-skills', category: 'development', desc: 'Community skills for superpowers' },
            { owner: 'asklokesh', repo: 'claudeskill-loki-mode', category: 'development', desc: 'Loki mode for enhanced coding' },
        ];
        this.githubService = new githubService_1.GitHubService();
        this.loadCuratedSkills();
    }
    refresh() {
        this.skills = [];
        this.filteredSkills = [];
        this.error = null;
        this.loadCuratedSkills();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
                return [new CommunitySkillItem(this.searchQuery ? 'No matching skills found' : 'No community skills loaded', vscode.TreeItemCollapsibleState.None, undefined, true)];
            }
            return displaySkills.map(skill => new CommunitySkillItem(skill.name, vscode.TreeItemCollapsibleState.None, skill));
        }
        return [];
    }
    async loadCuratedSkills() {
        this.loading = true;
        this._onDidChangeTreeData.fire();
        const loadedSkills = [];
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
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error(`Failed to load ${curated.owner}/${curated.repo}:`, err);
                // Check if it's a rate limit error
                if (errorMsg.includes('403') || errorMsg.includes('rate limit')) {
                    this.error = '⚠️ GitHub API limit reached. Click 🔓 to sign in.';
                    this.loading = false;
                    this._onDidChangeTreeData.fire();
                    return;
                }
            }
        }
        // Sort by stars
        this.skills = loadedSkills.sort((a, b) => b.stars - a.stars);
        if (this.skills.length === 0 && !this.error) {
            this.error = '⚠️ No skills loaded. Click 🔓 to sign in to GitHub.';
        }
        this.applyFilter();
        this.loading = false;
        this._onDidChangeTreeData.fire();
    }
    async search(query) {
        this.searchQuery = query;
        this.loading = true;
        this._onDidChangeTreeData.fire();
        try {
            const results = await this.githubService.searchSkillRepos(query);
            const config = vscode.workspace.getConfiguration('antigravity');
            const minStars = config.get('minStars') || 0;
            const showUnverified = config.get('showUnverifiedSkills') || false;
            const searchSkills = [];
            for (const repo of results) {
                // Check if meets star requirement
                if (repo.stargazers_count < minStars)
                    continue;
                // Check for SKILL.md
                const verified = await this.githubService.hasSkillMd(repo.owner.login, repo.name);
                if (!verified && !showUnverified)
                    continue;
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
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : 'Search failed';
            this.filteredSkills = [];
        }
        finally {
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
    }
    setFilter(filter) {
        this.currentFilter = filter;
        this.applyFilter();
        this._onDidChangeTreeData.fire();
    }
    clearFilter() {
        this.currentFilter = {};
        this.searchQuery = '';
        this.filteredSkills = [];
        this._onDidChangeTreeData.fire();
    }
    applyFilter() {
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
                const hasKeyword = this.currentFilter.keywords.some(kw => text.includes(kw.toLowerCase()));
                if (!hasKeyword)
                    return false;
            }
            // Updated within filter
            if (this.currentFilter.updatedWithin) {
                const now = new Date();
                const updated = new Date(skill.updatedAt);
                const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
                const maxDays = {
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
    inferCategory(topics, description) {
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
    getSkillByName(name) {
        return this.skills.find(s => s.name === name) ||
            this.filteredSkills.find(s => s.name === name);
    }
    getAllSkills() {
        return this.filteredSkills.length > 0 ? this.filteredSkills : this.skills;
    }
}
exports.CommunitySkillsProvider = CommunitySkillsProvider;
//# sourceMappingURL=communitySkillsProvider.js.map