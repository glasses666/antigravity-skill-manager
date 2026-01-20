import * as vscode from 'vscode';
import { GitHubRepoContent, GitHubRepo, GitHubSearchResult } from '../types';

/**
 * GitHub API service for fetching skill repositories
 */
export class GitHubService {
    private baseUrl = 'https://api.github.com';
    private cachedToken: string | null = null;

    /**
     * Get GitHub token from VS Code authentication or settings
     */
    async getToken(): Promise<string | null> {
        // Check cached token first
        if (this.cachedToken) {
            return this.cachedToken;
        }

        // Try settings first
        const config = vscode.workspace.getConfiguration('antigravity');
        const settingsToken = config.get<string>('githubToken');
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
        } catch {
            // Authentication not available
        }

        return null;
    }

    /**
     * Login to GitHub using VS Code authentication
     */
    async login(): Promise<boolean> {
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            if (session) {
                this.cachedToken = session.accessToken;
                vscode.window.showInformationMessage(`Logged in to GitHub as ${session.account.label}`);
                return true;
            }
        } catch (err) {
            vscode.window.showErrorMessage(`GitHub login failed: ${err}`);
        }
        return false;
    }

    /**
     * Clear cached token
     */
    logout(): void {
        this.cachedToken = null;
    }

    private async getHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
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
    async getRepoContents(owner: string, repo: string, path: string = ''): Promise<GitHubRepoContent[]> {
        const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;

        const response = await fetch(url, { headers: await this.getHeaders() });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('GitHub API rate limit exceeded. Add a token in settings.');
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json() as GitHubRepoContent | GitHubRepoContent[];
        return Array.isArray(data) ? data : [data];
    }

    /**
     * Get repository info
     */
    async getRepoInfo(owner: string, repo: string): Promise<GitHubRepo> {
        const url = `${this.baseUrl}/repos/${owner}/${repo}`;

        const response = await fetch(url, { headers: await this.getHeaders() });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return response.json() as Promise<GitHubRepo>;
    }

    /**
     * Check if repository has SKILL.md
     */
    async hasSkillMd(owner: string, repo: string): Promise<boolean> {
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
                        } catch {
                            continue;
                        }
                    }
                }
            }

            return false;
        } catch {
            return false;
        }
    }


    /**
     * Check if a repo is an MCP tool (should be filtered out)
     */
    private _isMCPTool(repo: GitHubRepo): boolean {
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
    async discoverSkillRepos(page: number = 1, perPage: number = 30): Promise<{ repos: GitHubRepo[]; hasMore: boolean; total: number }> {
        // Use a single efficient query for paginated results
        const query = 'topic:claude-code OR topic:ai-skills OR topic:antigravity OR SKILL.md in:path';
        const searchQuery = encodeURIComponent(query);
        const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;

        try {
            const response = await fetch(url, { headers: await this.getHeaders() });

            if (response.ok) {
                const data = await response.json() as GitHubSearchResult;
                // Filter out MCP tools
                const filteredRepos = (data.items || []).filter(repo => !this._isMCPTool(repo));
                const total = data.total_count || 0;
                const hasMore = page * perPage < total;

                return { repos: filteredRepos, hasMore, total };
            }
        } catch (err) {
            console.error('Discover skill repos failed:', err);
        }

        return { repos: [], hasMore: false, total: 0 };
    }

    /**
     * Search skill repositories by query
     */
    async searchSkillRepos(query: string, page: number = 1, perPage: number = 30): Promise<{ repos: GitHubRepo[]; hasMore: boolean; total: number }> {
        // Combine user query with skill-related filters
        const searchQuery = encodeURIComponent(`${query} (topic:claude-code OR topic:ai-skills OR SKILL.md in:path)`);
        const url = `${this.baseUrl}/search/repositories?q=${searchQuery}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;

        try {
            const response = await fetch(url, { headers: await this.getHeaders() });

            if (response.ok) {
                const data = await response.json() as GitHubSearchResult;
                // Filter out MCP tools
                const filteredRepos = (data.items || []).filter(repo => !this._isMCPTool(repo));
                const total = data.total_count || 0;
                const hasMore = page * perPage < total;

                return { repos: filteredRepos, hasMore, total };
            }
        } catch (err) {
            console.error('Search skill repos failed:', err);
        }

        return { repos: [], hasMore: false, total: 0 };
    }

    /**
     * Get raw file content
     */
    async getRawContent(owner: string, repo: string, path: string): Promise<string> {
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
    async downloadSkill(
        owner: string,
        repo: string,
        skillPath: string,
        destPath: string,
        onProgress?: (message: string, increment?: number) => void
    ): Promise<void> {
        const fs = await import('fs');
        const path = await import('path');

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
            } else if (item.type === 'file' && item.download_url) {
                onProgress?.(`Downloading: ${item.name} (${processed}/${totalItems})`, 100 / totalItems);
                // Download file - handle binary vs text files
                const response = await fetch(item.download_url);
                const ext = item.name.split('.').pop()?.toLowerCase() || '';
                const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'otf', 'pdf', 'zip', 'tar', 'gz'];

                if (binaryExtensions.includes(ext)) {
                    // Binary file - use arrayBuffer
                    const buffer = await response.arrayBuffer();
                    fs.writeFileSync(itemDest, Buffer.from(buffer));
                } else {
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
    async cloneSkill(repoUrl: string, destPath: string): Promise<void> {
        const fs = await import('fs');
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Try git clone first
        try {
            await execAsync(`git clone --depth 1 "${repoUrl}" "${destPath}"`);

            // Remove .git directory
            const gitDir = await import('path').then(p => p.join(destPath, '.git'));
            if (fs.existsSync(gitDir)) {
                fs.rmSync(gitDir, { recursive: true, force: true });
            }
        } catch {
            // Fallback to API download if git is not available
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (match) {
                const [, owner, repo] = match;
                await this.downloadSkill(owner, repo.replace('.git', ''), '', destPath);
            } else {
                throw new Error('Invalid GitHub URL');
            }
        }
    }
}
