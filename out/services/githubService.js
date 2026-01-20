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
     * Search for skill repositories on GitHub
     */
    async searchSkillRepos(query) {
        // Search for repos with SKILL.md in path
        const searchQuery = encodeURIComponent(`${query} SKILL.md in:path`);
        const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=30`;
        const response = await fetch(url, { headers: await this.getHeaders() });
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('GitHub API rate limit exceeded');
            }
            throw new Error(`Search failed: ${response.status}`);
        }
        const data = await response.json();
        return data.items || [];
    }
    /**
     * Discover all skill repositories by searching for SKILL.md files
     */
    async discoverSkillRepos() {
        // Multiple search strategies for comprehensive discovery
        const queries = [
            // Topic-based searches (most reliable)
            'topic:claude-code',
            'topic:ai-skills',
            'topic:antigravity',
            'topic:claude-skill',
            'topic:cursor-ai skill',
            // Content-based searches
            'SKILL.md in:path',
            'SKILL.md in:name',
            // Description-based searches
            'claude skill in:description',
            'AI skill claude in:description',
            'antigravity skill in:description'
        ];
        const allRepos = new Map();
        for (const query of queries) {
            try {
                const searchQuery = encodeURIComponent(query);
                // Increased per_page to 100 for better coverage
                const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=100`;
                const response = await fetch(url, { headers: await this.getHeaders() });
                if (response.ok) {
                    const data = await response.json();
                    for (const repo of data.items || []) {
                        // Deduplicate by full_name
                        if (!allRepos.has(repo.full_name)) {
                            allRepos.set(repo.full_name, repo);
                        }
                    }
                }
            }
            catch (err) {
                console.error(`Search query failed: ${query}`, err);
            }
        }
        // Sort by stars and return
        return Array.from(allRepos.values()).sort((a, b) => b.stargazers_count - a.stargazers_count);
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