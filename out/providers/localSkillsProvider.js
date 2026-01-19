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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalSkillsProvider = exports.LocalSkillItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const gray_matter_1 = __importDefault(require("gray-matter"));
/**
 * Tree item for local skills
 */
class LocalSkillItem extends vscode.TreeItem {
    constructor(label, collapsibleState, skill, filePath, isDirectory) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.skill = skill;
        this.filePath = filePath;
        this.isDirectory = isDirectory;
        if (skill) {
            // Root skill item
            this.contextValue = 'localSkill';
            this.tooltip = skill.metadata.description || skill.name;
            this.iconPath = new vscode.ThemeIcon('package');
            this.description = this.getSkillBadges(skill);
        }
        else if (filePath) {
            // File or directory within skill
            if (isDirectory) {
                this.contextValue = 'localSkillDir';
                this.iconPath = new vscode.ThemeIcon('folder');
            }
            else {
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
    getSkillBadges(skill) {
        const badges = [];
        if (skill.hasScripts)
            badges.push('📜');
        if (skill.hasData)
            badges.push('📊');
        if (skill.hasExamples)
            badges.push('📁');
        return badges.join(' ');
    }
    getFileIcon(filePath) {
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
exports.LocalSkillItem = LocalSkillItem;
/**
 * Local skills tree data provider
 */
class LocalSkillsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.skills = [];
        this.loadSkills();
    }
    refresh() {
        this.loadSkills();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show all skills
            return this.skills.map(skill => new LocalSkillItem(skill.name, vscode.TreeItemCollapsibleState.Collapsed, skill));
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
    getSkillsPath() {
        const config = vscode.workspace.getConfiguration('antigravity');
        const customPath = config.get('skillsPath');
        if (customPath && customPath.trim()) {
            return customPath;
        }
        // Default path
        return path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
    }
    loadSkills() {
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
    parseSkillMetadata(skillMdPath) {
        try {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const { data } = (0, gray_matter_1.default)(content);
            return {
                name: data.name || '',
                description: data.description || ''
            };
        }
        catch {
            return { name: '', description: '' };
        }
    }
    async getSkillContents(skillPath) {
        const items = [];
        const entries = fs.readdirSync(skillPath, { withFileTypes: true });
        // Sort: directories first, then files
        const dirs = entries.filter(e => e.isDirectory());
        const files = entries.filter(e => e.isFile());
        // Add SKILL.md first if exists
        const skillMd = files.find(f => f.name === 'SKILL.md');
        if (skillMd) {
            items.push(new LocalSkillItem('SKILL.md', vscode.TreeItemCollapsibleState.None, undefined, path.join(skillPath, 'SKILL.md'), false));
        }
        // Add directories
        for (const dir of dirs) {
            if (!dir.name.startsWith('.') && dir.name !== '__pycache__') {
                items.push(new LocalSkillItem(dir.name, vscode.TreeItemCollapsibleState.Collapsed, undefined, path.join(skillPath, dir.name), true));
            }
        }
        // Add other files
        for (const file of files) {
            if (file.name !== 'SKILL.md' && !file.name.startsWith('.')) {
                items.push(new LocalSkillItem(file.name, vscode.TreeItemCollapsibleState.None, undefined, path.join(skillPath, file.name), false));
            }
        }
        return items;
    }
    async getDirectoryContents(dirPath) {
        const items = [];
        if (!fs.existsSync(dirPath)) {
            return items;
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === '__pycache__') {
                continue;
            }
            const fullPath = path.join(dirPath, entry.name);
            items.push(new LocalSkillItem(entry.name, entry.isDirectory()
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None, undefined, fullPath, entry.isDirectory()));
        }
        return items;
    }
    getSkillByName(name) {
        return this.skills.find(s => s.name === name);
    }
    getSkillsDirectory() {
        return this.getSkillsPath();
    }
}
exports.LocalSkillsProvider = LocalSkillsProvider;
//# sourceMappingURL=localSkillsProvider.js.map