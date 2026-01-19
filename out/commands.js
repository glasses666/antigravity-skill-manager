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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const githubService_1 = require("./services/githubService");
const skillWizard_1 = require("./webview/skillWizard");
/**
 * Register all extension commands
 */
function registerCommands(context, localProvider, githubProvider, communityProvider) {
    const githubService = new githubService_1.GitHubService();
    // Refresh skills
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.refreshSkills', () => {
        localProvider.refresh();
        githubProvider.refresh();
        communityProvider.refresh();
        vscode.window.showInformationMessage('Skills refreshed');
    }));
    // Create new skill - opens wizard
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.createSkill', () => {
        skillWizard_1.SkillWizardPanel.createOrShow(context.extensionUri, localProvider.getSkillsDirectory());
    }));
    // Install skill from GitHub
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.installSkill', async (item) => {
        let repoUrl;
        let skillPath;
        let skillName;
        if (item?.skill) {
            // From tree view item
            if (item.skill.repoUrl) {
                // Community skill
                repoUrl = item.skill.repoUrl;
                skillName = item.skill.name;
            }
            else if (item.skill.url) {
                // GitHub official skill
                repoUrl = `https://github.com/${item.skill.repoOwner}/${item.skill.repoName}`;
                skillPath = item.skill.path;
                skillName = item.skill.name;
            }
        }
        else {
            // Manual input
            repoUrl = await vscode.window.showInputBox({
                prompt: 'Enter GitHub repository URL',
                placeHolder: 'https://github.com/owner/repo or owner/repo'
            });
        }
        if (!repoUrl)
            return;
        // Normalize URL
        if (!repoUrl.startsWith('https://')) {
            repoUrl = `https://github.com/${repoUrl}`;
        }
        // Parse owner/repo
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) {
            vscode.window.showErrorMessage('Invalid GitHub URL');
            return;
        }
        const [, owner, repo] = match;
        const repoName = repo.replace('.git', '');
        if (!skillName) {
            skillName = await vscode.window.showInputBox({
                prompt: 'Enter local skill name',
                value: repoName,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Skill name is required';
                    }
                    return null;
                }
            });
        }
        if (!skillName)
            return;
        const destPath = path.join(localProvider.getSkillsDirectory(), skillName);
        if (fs.existsSync(destPath)) {
            const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Skill "${skillName}" already exists. Overwrite?`
            });
            if (overwrite !== 'Yes')
                return;
            fs.rmSync(destPath, { recursive: true, force: true });
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing skill "${skillName}"...`,
            cancellable: false
        }, async () => {
            try {
                if (skillPath) {
                    // Download specific subdirectory
                    await githubService.downloadSkill(owner, repoName, skillPath, destPath);
                }
                else {
                    // Clone entire repo
                    await githubService.cloneSkill(repoUrl, destPath);
                }
                localProvider.refresh();
                vscode.window.showInformationMessage(`Skill "${skillName}" installed successfully`);
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed to install skill: ${err}`);
            }
        });
    }));
    // Open skill file
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.openSkillFile', async (item) => {
        if (item?.filePath) {
            const doc = await vscode.workspace.openTextDocument(item.filePath);
            await vscode.window.showTextDocument(doc);
        }
        else if (item?.skill?.path) {
            const skillMdPath = path.join(item.skill.path, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
                const doc = await vscode.workspace.openTextDocument(skillMdPath);
                await vscode.window.showTextDocument(doc);
            }
        }
    }));
    // Open in GitHub
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.openInGitHub', (item) => {
        if (item?.skill) {
            const url = item.skill.repoUrl || item.skill.url;
            if (url) {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }
    }));
    // Delete skill
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.deleteSkill', async (item) => {
        if (!item?.skill?.path)
            return;
        const confirm = await vscode.window.showWarningMessage(`Delete skill "${item.skill.name}"? This cannot be undone.`, { modal: true }, 'Delete');
        if (confirm !== 'Delete')
            return;
        try {
            fs.rmSync(item.skill.path, { recursive: true, force: true });
            localProvider.refresh();
            vscode.window.showInformationMessage(`Skill "${item.skill.name}" deleted`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to delete skill: ${err}`);
        }
    }));
    // Reveal in Explorer
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.revealInExplorer', (item) => {
        if (item?.skill?.path) {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.skill.path));
        }
    }));
    // Search skills
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.searchSkills', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Search for skills on GitHub',
            placeHolder: 'e.g., testing, security, automation'
        });
        if (query) {
            await communityProvider.search(query);
        }
    }));
    // Filter skills
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.filterSkills', async () => {
        const categories = ['development', 'design', 'security', 'document', 'testing', 'automation', 'other'];
        const selected = await vscode.window.showQuickPick([
            { label: '$(clear-all) Clear filters', value: 'clear' },
            { label: '$(star-full) By minimum stars...', value: 'stars' },
            { label: '$(calendar) Updated recently...', value: 'updated' },
            { label: '$(verified) Verified only', value: 'verified' },
            ...categories.map(cat => ({
                label: `$(tag) ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                value: `category:${cat}`
            }))
        ], {
            placeHolder: 'Select filter option'
        });
        if (!selected)
            return;
        if (selected.value === 'clear') {
            communityProvider.clearFilter();
            return;
        }
        if (selected.value === 'stars') {
            const stars = await vscode.window.showInputBox({
                prompt: 'Minimum stars',
                value: '10',
                validateInput: (value) => {
                    if (isNaN(parseInt(value)))
                        return 'Enter a number';
                    return null;
                }
            });
            if (stars) {
                communityProvider.setFilter({ minStars: parseInt(stars) });
            }
        }
        else if (selected.value === 'updated') {
            const period = await vscode.window.showQuickPick([
                { label: 'Last week', value: '1week' },
                { label: 'Last month', value: '1month' },
                { label: 'Last 3 months', value: '3months' },
                { label: 'Last year', value: '1year' }
            ], { placeHolder: 'Updated within...' });
            if (period) {
                communityProvider.setFilter({ updatedWithin: period.value });
            }
        }
        else if (selected.value === 'verified') {
            communityProvider.setFilter({ verifiedOnly: true });
        }
        else if (selected.value.startsWith('category:')) {
            const category = selected.value.replace('category:', '');
            communityProvider.setFilter({ categories: [category] });
        }
    }));
    // GitHub Login
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.loginGitHub', async () => {
        const success = await githubService.login();
        if (success) {
            // Refresh all providers after login
            githubProvider.refresh();
            communityProvider.refresh();
        }
    }));
    // Show skill details
    context.subscriptions.push(vscode.commands.registerCommand('antigravity.showDetails', async (item) => {
        if (item?.skill) {
            const { SkillDetailsPanel } = await Promise.resolve().then(() => __importStar(require('./webview/skillDetails')));
            SkillDetailsPanel.createOrShow(context.extensionUri, item.skill, localProvider.getSkillsDirectory());
        }
    }));
}
//# sourceMappingURL=commands.js.map