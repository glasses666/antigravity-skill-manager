import * as vscode from 'vscode';
import { LocalSkillsProvider } from './providers/localSkillsProvider';
import { GitHubSkillsProvider } from './providers/githubSkillsProvider';
import { CommunitySkillsProvider } from './providers/communitySkillsProvider';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Skill Manager is now active!');

    // Create providers
    const localProvider = new LocalSkillsProvider();
    const githubProvider = new GitHubSkillsProvider();
    const communityProvider = new CommunitySkillsProvider();

    // Register tree views
    const localTreeView = vscode.window.createTreeView('localSkills', {
        treeDataProvider: localProvider,
        showCollapseAll: true
    });

    const githubTreeView = vscode.window.createTreeView('githubSkills', {
        treeDataProvider: githubProvider,
        showCollapseAll: true
    });

    const communityTreeView = vscode.window.createTreeView('communitySkills', {
        treeDataProvider: communityProvider,
        showCollapseAll: true
    });

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

    context.subscriptions.push(localTreeView, githubTreeView, communityTreeView);
}

export function deactivate() { }
