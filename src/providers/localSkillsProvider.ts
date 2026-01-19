import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import matter from 'gray-matter';
import { LocalSkill, SkillMetadata } from '../types';

/**
 * Tree item for local skills
 */
export class LocalSkillItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly skill?: LocalSkill,
        public readonly filePath?: string,
        public readonly isDirectory?: boolean
    ) {
        super(label, collapsibleState);

        if (skill) {
            // Root skill item
            this.contextValue = 'localSkill';
            this.tooltip = skill.metadata.description || skill.name;
            this.iconPath = new vscode.ThemeIcon('package');
            this.description = this.getSkillBadges(skill);
        } else if (filePath) {
            // File or directory within skill
            if (isDirectory) {
                this.contextValue = 'localSkillDir';
                this.iconPath = new vscode.ThemeIcon('folder');
            } else {
                this.contextValue = 'localSkillFile';
                this.iconPath = this.getFileIcon(filePath);
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(filePath)]
                };
            }
        }
    }

    private getSkillBadges(skill: LocalSkill): string {
        const badges: string[] = [];
        if (skill.hasScripts) badges.push('📜');
        if (skill.hasData) badges.push('📊');
        if (skill.hasExamples) badges.push('📁');
        return badges.join(' ');
    }

    private getFileIcon(filePath: string): vscode.ThemeIcon {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.md': return new vscode.ThemeIcon('markdown');
            case '.py': return new vscode.ThemeIcon('symbol-method');
            case '.js':
            case '.ts': return new vscode.ThemeIcon('symbol-variable');
            case '.json': return new vscode.ThemeIcon('json');
            case '.csv': return new vscode.ThemeIcon('table');
            case '.html': return new vscode.ThemeIcon('code');
            default: return new vscode.ThemeIcon('file');
        }
    }
}

/**
 * Local skills tree data provider
 */
export class LocalSkillsProvider implements vscode.TreeDataProvider<LocalSkillItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<LocalSkillItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private skills: LocalSkill[] = [];

    constructor() {
        this.loadSkills();
    }

    refresh(): void {
        this.loadSkills();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LocalSkillItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LocalSkillItem): Promise<LocalSkillItem[]> {
        if (!element) {
            // Root level - show all skills
            return this.skills.map(skill => new LocalSkillItem(
                skill.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                skill
            ));
        }

        if (element.skill) {
            // Show skill contents
            return this.getSkillContents(element.skill.path);
        }

        if (element.filePath && element.isDirectory) {
            // Show directory contents
            return this.getDirectoryContents(element.filePath);
        }

        return [];
    }

    private getSkillsPath(): string {
        const config = vscode.workspace.getConfiguration('antigravity');
        const customPath = config.get<string>('skillsPath');

        if (customPath && customPath.trim()) {
            return customPath;
        }

        // Default path
        return path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
    }

    private loadSkills(): void {
        const skillsPath = this.getSkillsPath();
        this.skills = [];

        if (!fs.existsSync(skillsPath)) {
            return;
        }

        const entries = fs.readdirSync(skillsPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(skillsPath, entry.name);
                const skillMdPath = path.join(skillPath, 'SKILL.md');

                if (fs.existsSync(skillMdPath)) {
                    const metadata = this.parseSkillMetadata(skillMdPath);
                    this.skills.push({
                        name: metadata.name || entry.name,
                        path: skillPath,
                        metadata,
                        hasScripts: fs.existsSync(path.join(skillPath, 'scripts')),
                        hasData: fs.existsSync(path.join(skillPath, 'data')),
                        hasExamples: fs.existsSync(path.join(skillPath, 'examples'))
                    });
                }
            }
        }
    }

    private parseSkillMetadata(skillMdPath: string): SkillMetadata {
        try {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const { data } = matter(content);
            return {
                name: data.name || '',
                description: data.description || ''
            };
        } catch {
            return { name: '', description: '' };
        }
    }

    private async getSkillContents(skillPath: string): Promise<LocalSkillItem[]> {
        const items: LocalSkillItem[] = [];
        const entries = fs.readdirSync(skillPath, { withFileTypes: true });

        // Sort: directories first, then files
        const dirs = entries.filter(e => e.isDirectory());
        const files = entries.filter(e => e.isFile());

        // Add SKILL.md first if exists
        const skillMd = files.find(f => f.name === 'SKILL.md');
        if (skillMd) {
            items.push(new LocalSkillItem(
                'SKILL.md',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                path.join(skillPath, 'SKILL.md'),
                false
            ));
        }

        // Add directories
        for (const dir of dirs) {
            if (!dir.name.startsWith('.') && dir.name !== '__pycache__') {
                items.push(new LocalSkillItem(
                    dir.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined,
                    path.join(skillPath, dir.name),
                    true
                ));
            }
        }

        // Add other files
        for (const file of files) {
            if (file.name !== 'SKILL.md' && !file.name.startsWith('.')) {
                items.push(new LocalSkillItem(
                    file.name,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    path.join(skillPath, file.name),
                    false
                ));
            }
        }

        return items;
    }

    private async getDirectoryContents(dirPath: string): Promise<LocalSkillItem[]> {
        const items: LocalSkillItem[] = [];

        if (!fs.existsSync(dirPath)) {
            return items;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === '__pycache__') {
                continue;
            }

            const fullPath = path.join(dirPath, entry.name);

            items.push(new LocalSkillItem(
                entry.name,
                entry.isDirectory()
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.None,
                undefined,
                fullPath,
                entry.isDirectory()
            ));
        }

        return items;
    }

    getSkillByName(name: string): LocalSkill | undefined {
        return this.skills.find(s => s.name === name);
    }

    getSkillsDirectory(): string {
        return this.getSkillsPath();
    }
}
