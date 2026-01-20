import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { LocalSkillsProvider } from './providers/localSkillsProvider';
import { GitHubSkillsProvider } from './providers/githubSkillsProvider';
import { CommunitySkillsProvider } from './providers/communitySkillsProvider';
import { SkillsMarketplace } from './webview/skillsMarketplace';
import { LocalSkillsWebview } from './webview/localSkillsWebview';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Skill Manager is now active!');

    // Get skills path
    const config = vscode.workspace.getConfiguration('antigravity');
    const customPath = config.get<string>('skillsPath');
    const skillsPath = customPath || path.join(os.homedir(), '.gemini', 'antigravity', 'skills');

    // Create providers
    const localProvider = new LocalSkillsProvider();
    const githubProvider = new GitHubSkillsProvider();
    const communityProvider = new CommunitySkillsProvider();
    const marketplaceProvider = new SkillsMarketplace(context.extensionUri, skillsPath);

    // Register tree views
    const localTreeView = vscode.window.createTreeView('localSkills', {
        treeDataProvider: localProvider,
        showCollapseAll: true
    });

    const githubTreeView = vscode.window.createTreeView('githubSkills', {
        treeDataProvider: githubProvider,
        showCollapseAll: true
    });

    // Register webview providers
    const localSkillsWebview = new LocalSkillsWebview(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('localSkillsWebview', localSkillsWebview),
        vscode.window.registerWebviewViewProvider('skillsMarketplace', marketplaceProvider)
    );

    // Register commands
    registerCommands(context, localProvider, githubProvider, communityProvider);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('antigravity')) {
                localProvider.refresh();
            }
        })
    );

    context.subscriptions.push(localTreeView, githubTreeView);
}

export function deactivate() { }
