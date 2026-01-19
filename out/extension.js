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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const localSkillsProvider_1 = require("./providers/localSkillsProvider");
const githubSkillsProvider_1 = require("./providers/githubSkillsProvider");
const communitySkillsProvider_1 = require("./providers/communitySkillsProvider");
const skillsMarketplace_1 = require("./webview/skillsMarketplace");
const commands_1 = require("./commands");
function activate(context) {
    console.log('Antigravity Skill Manager is now active!');
    // Get skills path
    const config = vscode.workspace.getConfiguration('antigravity');
    const customPath = config.get('skillsPath');
    const skillsPath = customPath || path.join(os.homedir(), '.gemini', 'antigravity', 'skills');
    // Create providers
    const localProvider = new localSkillsProvider_1.LocalSkillsProvider();
    const githubProvider = new githubSkillsProvider_1.GitHubSkillsProvider();
    const communityProvider = new communitySkillsProvider_1.CommunitySkillsProvider();
    const marketplaceProvider = new skillsMarketplace_1.SkillsMarketplace(context.extensionUri, skillsPath);
    // Register tree views
    const localTreeView = vscode.window.createTreeView('localSkills', {
        treeDataProvider: localProvider,
        showCollapseAll: true
    });
    const githubTreeView = vscode.window.createTreeView('githubSkills', {
        treeDataProvider: githubProvider,
        showCollapseAll: true
    });
    // Register webview provider for marketplace
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('skillsMarketplace', marketplaceProvider));
    // Register commands
    (0, commands_1.registerCommands)(context, localProvider, githubProvider, communityProvider);
    // Watch for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('antigravity')) {
            localProvider.refresh();
        }
    }));
    context.subscriptions.push(localTreeView, githubTreeView);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map