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
exports.GitHubService = void 0;
const vscode = __importStar(require("vscode"));
/**
 * GitHub API service for fetching skill repositories
 */
class GitHubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.cachedToken = null;
    }
    /**
     * Get GitHub token from VS Code authentication or settings
     */
    async getToken() {
        // Check cached token first
        if (this.cachedToken) {
            return this.cachedToken;
        }
        // Try settings first
        const config = vscode.workspace.getConfiguration('antigravity');
        const settingsToken = config.get('githubToken');
        if (settingsToken && settingsToken.trim()) {
            this.cachedToken = settingsToken;
            return settingsToken;
        }
        // Try VS Code GitHub authentication
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
            if (session) {
                this.cachedToken = session.accessToken;
                return session.accessToken;
            }
        }
        catch {
            // Authentication not available
        }
        return null;
    }
    /**
     * Login to GitHub using VS Code authentication
     */
    async login() {
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            if (session) {
                this.cachedToken = session.accessToken;
                vscode.window.showInformationMessage(`Logged in to GitHub as ${session.account.label}`);
                return true;
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`GitHub login failed: ${err}`);
        }
        return false;
    }
    /**
     * Clear cached token
     */
    logout() {
        this.cachedToken = null;
    }
    async getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'antigravity-skill-manager'
        };
        const token = await this.getToken();
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        return headers;
    }
    /**
     * Get repository contents
     */
    async getRepoContents(owner, repo, path = '') {
        const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
        const response = await fetch(url, { headers: await this.getHeaders() });
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('GitHub API rate limit exceeded. Add a token in settings.');
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [data];
    }
    /**
     * Get repository info
     */
    async getRepoInfo(owner, repo) {
        const url = `${this.baseUrl}/repos/${owner}/${repo}`;
        const response = await fetch(url, { headers: await this.getHeaders() });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        return response.json();
    }
    /**
     * Check if repository has SKILL.md
     */
    async hasSkillMd(owner, repo) {
        try {
            // Check root
            const rootContents = await this.getRepoContents(owner, repo);
            if (rootContents.some(item => item.name === 'SKILL.md')) {
                return true;
            }
            // Check skills subdirectory if exists
            const skillsDir = rootContents.find(item => item.name === 'skills' && item.type === 'dir');
            if (skillsDir) {
                const skillsContents = await this.getRepoContents(owner, repo, 'skills');
                // If skills directory has subdirectories, each should have SKILL.md
                for (const item of skillsContents) {
                    if (item.type === 'dir') {
                        try {
                            const subContents = await this.getRepoContents(owner, repo, item.path);
                            if (subContents.some(f => f.name === 'SKILL.md')) {
                                return true;
                            }
                        }
                        catch {
                            continue;
                        }
                    }
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if a repo is an MCP tool (should be filtered out)
     */
    _isMCPTool(repo) {
        const name = repo.name.toLowerCase();
        const desc = (repo.description || '').toLowerCase();
        const topics = repo.topics || [];
        // Filter out MCP (Model Context Protocol) tools
        if (topics.includes('mcp') || topics.includes('mcp-server') || topics.includes('model-context-protocol')) {
            return true;
        }
        if (name.includes('mcp-') || name.includes('-mcp') || name === 'mcp') {
            return true;
        }
        if (desc.includes('model context protocol') || desc.includes('mcp server')) {
            return true;
        }
        return false;
    }
    /**
     * Discover skill repositories with pagination
     */
    async discoverSkillRepos(page = 1, perPage = 30) {
        // Use a single efficient query for paginated results
        const query = 'topic:antigravity OR topic:ai-skills OR topic:claude-code';
        // Note: Complex OR queries can be unstable. Using a simple query that is known to work.
        const searchQuery = encodeURIComponent('topic:antigravity');
        const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;
        try {
            const response = await fetch(url, { headers: await this.getHeaders() });
            if (response.ok) {
                const data = await response.json();
                // Filter out MCP tools
                const filteredRepos = (data.items || []).filter(repo => !this._isMCPTool(repo));
                const total = data.total_count || 0;
                const hasMore = page * perPage < total;
                return { repos: filteredRepos, hasMore, total };
            }
            else {
                console.error('GitHub API Error:', await response.text());
            }
        }
        catch (err) {
            console.error('Discover skill repos failed:', err);
        }
        return { repos: [], hasMore: false, total: 0 };
    }
    /**
     * Search skill repositories by query
     */
    async searchSkillRepos(query, page = 1, perPage = 30) {
        // Combine user query with skill-related filters
        const searchQuery = encodeURIComponent(`${query} (topic:claude-code OR topic:ai-skills OR SKILL.md in:path)`);
        const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;
        try {
            const response = await fetch(url, { headers: await this.getHeaders() });
            if (response.ok) {
                const data = await response.json();
                // Filter out MCP tools
                const filteredRepos = (data.items || []).filter(repo => !this._isMCPTool(repo));
                const total = data.total_count || 0;
                const hasMore = page * perPage < total;
                return { repos: filteredRepos, hasMore, total };
            }
        }
        catch (err) {
            console.error('Search skill repos failed:', err);
        }
        return { repos: [], hasMore: false, total: 0 };
    }
    /**
     * Get raw file content
     */
    async getRawContent(owner, repo, path) {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
        const response = await fetch(url);
        if (!response.ok) {
            // Try master branch
            const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`;
            const masterResponse = await fetch(masterUrl);
            if (!masterResponse.ok) {
                throw new Error(`File not found: ${path}`);
            }
            return masterResponse.text();
        }
        return response.text();
    }
    /**
     * Download a skill from GitHub with progress callback
     */
    async downloadSkill(owner, repo, skillPath, destPath, onProgress) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        // Create destination directory
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }
        // Get all files in the skill directory
        onProgress?.(`Fetching file list...`);
        const contents = await this.getRepoContents(owner, repo, skillPath);
        const totalItems = contents.length;
        let processed = 0;
        for (const item of contents) {
            const itemDest = path.join(destPath, item.name);
            processed++;
            if (item.type === 'dir') {
                onProgress?.(`Downloading folder: ${item.name}`, 100 / totalItems);
                // Recursively download directory
                await this.downloadSkill(owner, repo, item.path, itemDest, onProgress);
            }
            else if (item.type === 'file' && item.download_url) {
                onProgress?.(`Downloading: ${item.name} (${processed}/${totalItems})`, 100 / totalItems);
                // Download file - handle binary vs text files
                const response = await fetch(item.download_url);
                const ext = item.name.split('.').pop()?.toLowerCase() || '';
                const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'otf', 'pdf', 'zip', 'tar', 'gz'];
                if (binaryExtensions.includes(ext)) {
                    // Binary file - use arrayBuffer
                    const buffer = await response.arrayBuffer();
                    fs.writeFileSync(itemDest, Buffer.from(buffer));
                }
                else {
                    // Text file
                    const content = await response.text();
                    fs.writeFileSync(itemDest, content, 'utf-8');
                }
            }
        }
    }
    /**
     * Clone entire repository's skill
     */
    async cloneSkill(repoUrl, destPath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const execAsync = promisify(exec);
        // Try git clone first
        try {
            await execAsync(`git clone --depth 1 "${repoUrl}" "${destPath}"`);
            // Remove .git directory
            const gitDir = await Promise.resolve().then(() => __importStar(require('path'))).then(p => p.join(destPath, '.git'));
            if (fs.existsSync(gitDir)) {
                fs.rmSync(gitDir, { recursive: true, force: true });
            }
        }
        catch {
            // Fallback to API download if git is not available
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (match) {
                const [, owner, repo] = match;
                await this.downloadSkill(owner, repo.replace('.git', ''), '', destPath);
            }
            else {
                throw new Error('Invalid GitHub URL');
            }
        }
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=githubService.js.map