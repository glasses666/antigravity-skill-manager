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
exports.GitHubSkillsProvider = exports.GitHubSkillItem = void 0;
const vscode = __importStar(require("vscode"));
const githubService_1 = require("../services/githubService");
/**
 * Tree item for GitHub skills
 */
class GitHubSkillItem extends vscode.TreeItem {
    constructor(label, collapsibleState, skill, isCategory) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.skill = skill;
        this.isCategory = isCategory;
        if (isCategory) {
            this.contextValue = 'githubCategory';
            this.iconPath = new vscode.ThemeIcon('folder-library');
        }
        else if (skill) {
            this.contextValue = 'githubSkill';
            this.tooltip = skill.description;
            this.iconPath = skill.verified
                ? new vscode.ThemeIcon('verified')
                : new vscode.ThemeIcon('package');
            this.description = skill.stars !== undefined ? `⭐ ${skill.stars}` : '';
        }
    }
}
exports.GitHubSkillItem = GitHubSkillItem;
/**
 * GitHub official skills provider (anthropics/skills)
 */
class GitHubSkillsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.skills = [];
        this.loading = false;
        this.error = null;
        // Skill categories from anthropics/skills
        this.categories = [
            { name: 'Creative & Design', path: 'skills', filter: ['art-styles', 'branding', 'music'] },
            { name: 'Development', path: 'skills', filter: ['mcp-server-generator', 'webapp-testing'] },
            { name: 'Document Skills', path: 'skills', filter: ['docx', 'pdf', 'pptx', 'xlsx'] },
            { name: 'Communication', path: 'skills', filter: ['email', 'comms'] }
        ];
        this.githubService = new githubService_1.GitHubService();
        this.loadSkills();
    }
    refresh() {
        this.skills = [];
        this.error = null;
        this.loadSkills();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
            return this.skills.map(skill => new GitHubSkillItem(skill.name, vscode.TreeItemCollapsibleState.None, skill));
        }
        return [];
    }
    async loadSkills() {
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
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : 'Failed to load skills';
            this.skills = [];
        }
        finally {
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
    }
    getSkillDescription(name) {
        // Known skill descriptions
        const descriptions = {
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
    getSkillByName(name) {
        return this.skills.find(s => s.name === name);
    }
}
exports.GitHubSkillsProvider = GitHubSkillsProvider;
//# sourceMappingURL=githubSkillsProvider.js.map