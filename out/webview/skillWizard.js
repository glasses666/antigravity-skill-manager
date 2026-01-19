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
exports.SkillWizardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Skill Creation Wizard - Webview panel for easy skill creation
 */
class SkillWizardPanel {
    static createOrShow(extensionUri, skillsPath) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If panel already exists, show it
        if (SkillWizardPanel.currentPanel) {
            SkillWizardPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Create a new panel
        const panel = vscode.window.createWebviewPanel('skillWizard', 'Create New Skill', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        SkillWizardPanel.currentPanel = new SkillWizardPanel(panel, extensionUri, skillsPath);
    }
    constructor(panel, extensionUri, skillsPath) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._skillsPath = skillsPath;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'createSkill':
                    this._createSkill(message.data);
                    return;
                case 'cancel':
                    this._panel.dispose();
                    return;
            }
        }, null, this._disposables);
    }
    async _createSkill(data) {
        const skillPath = path.join(this._skillsPath, data.name);
        if (fs.existsSync(skillPath)) {
            vscode.window.showErrorMessage(`Skill "${data.name}" already exists!`);
            return;
        }
        try {
            // Create directories
            fs.mkdirSync(skillPath, { recursive: true });
            if (data.createScripts) {
                fs.mkdirSync(path.join(skillPath, 'scripts'), { recursive: true });
                // Create a sample script
                fs.writeFileSync(path.join(skillPath, 'scripts', 'main.py'), `#!/usr/bin/env python3\n"""\n${data.displayName} - Main Script\n"""\n\ndef main():\n    print("Hello from ${data.name}!")\n\nif __name__ == "__main__":\n    main()\n`, 'utf-8');
            }
            if (data.createData) {
                fs.mkdirSync(path.join(skillPath, 'data'), { recursive: true });
                fs.writeFileSync(path.join(skillPath, 'data', '.gitkeep'), '', 'utf-8');
            }
            if (data.createExamples) {
                fs.mkdirSync(path.join(skillPath, 'examples'), { recursive: true });
                fs.writeFileSync(path.join(skillPath, 'examples', 'example.md'), `# Example Usage\n\n## Basic Usage\n\n\`\`\`\n// Add your example here\n\`\`\`\n`, 'utf-8');
            }
            // Create SKILL.md
            const skillMdContent = this._generateSkillMd(data);
            fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMdContent, 'utf-8');
            // Show success and open the file
            vscode.window.showInformationMessage(`Skill "${data.displayName}" created successfully!`);
            const doc = await vscode.workspace.openTextDocument(path.join(skillPath, 'SKILL.md'));
            await vscode.window.showTextDocument(doc);
            this._panel.dispose();
            // Refresh the tree view
            vscode.commands.executeCommand('antigravity.refreshSkills');
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to create skill: ${err}`);
        }
    }
    _generateSkillMd(data) {
        const categoryKeywords = this._getCategoryKeywords(data.category);
        return `---
name: ${data.name}
description: "${data.description}${categoryKeywords}"
---

# ${data.displayName}

${data.description}

## How to Use This Skill

${data.instructions || 'Describe how to use this skill here.'}

## Prerequisites

- List any prerequisites here
- For example: Python 3.8+, Node.js 18+, etc.

## Examples

### Basic Usage

\`\`\`
// Add usage examples here
\`\`\`

## Tips

- Add helpful tips for using this skill
- Include best practices and common patterns
`;
    }
    _getCategoryKeywords(category) {
        const keywords = {
            development: ' Keywords: development, coding, programming, code generation',
            testing: ' Keywords: testing, test automation, QA, validation',
            design: ' Keywords: design, UI, UX, visualization, graphics',
            security: ' Keywords: security, audit, vulnerability, penetration testing',
            document: ' Keywords: document, documentation, writing, markdown',
            automation: ' Keywords: automation, workflow, CI/CD, scripting',
            other: ''
        };
        return keywords[category] || '';
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create New Skill</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        
        h1 {
            font-size: 24px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        h1::before {
            content: "🧠";
            font-size: 28px;
        }
        
        .subtitle {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 24px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
        }
        
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        input[type="text"], textarea, select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        }
        
        input[type="text"]:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        textarea {
            min-height: 100px;
            resize: vertical;
        }
        
        .checkbox-group {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }
        
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .checkbox-item input[type="checkbox"] {
            width: 18px;
            height: 18px;
        }
        
        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            font-weight: 600;
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .preview {
            margin-top: 24px;
            padding: 16px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            border-radius: 4px;
        }
        
        .preview h3 {
            margin-top: 0;
            margin-bottom: 12px;
        }
        
        .preview-content {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 13px;
            white-space: pre-wrap;
            color: var(--vscode-descriptionForeground);
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-top: 24px;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
    </style>
</head>
<body>
    <h1>Create New Skill</h1>
    <p class="subtitle">Fill in the details below to create a new Antigravity/Claude Code skill</p>
    
    <form id="skillForm">
        <div class="section-title">📝 Basic Information</div>
        
        <div class="form-group">
            <label for="displayName">Skill Display Name *</label>
            <input type="text" id="displayName" placeholder="e.g., My Awesome Skill" required>
            <div class="hint">Human-readable name shown in the UI</div>
        </div>
        
        <div class="form-group">
            <label for="name">Skill ID *</label>
            <input type="text" id="name" placeholder="e.g., my-awesome-skill" required pattern="^[a-z0-9-]+$">
            <div class="hint">Lowercase letters, numbers, and hyphens only. This becomes the folder name.</div>
        </div>
        
        <div class="form-group">
            <label for="description">Description *</label>
            <textarea id="description" placeholder="Describe what this skill does and when it should be used..." required></textarea>
            <div class="hint">This helps Claude understand when to use this skill</div>
        </div>
        
        <div class="form-group">
            <label for="category">Category</label>
            <select id="category">
                <option value="development">💻 Development & Coding</option>
                <option value="testing">🧪 Testing & QA</option>
                <option value="design">🎨 Design & Visualization</option>
                <option value="security">🔒 Security</option>
                <option value="document">📄 Documentation</option>
                <option value="automation">⚙️ Automation</option>
                <option value="other">📦 Other</option>
            </select>
        </div>
        
        <div class="section-title">📖 Instructions</div>
        
        <div class="form-group">
            <label for="instructions">How to Use (Instructions for Claude)</label>
            <textarea id="instructions" placeholder="Explain step-by-step how Claude should use this skill...

Example:
1. First, analyze the user's request
2. Then, run the search script with: python scripts/search.py
3. Finally, synthesize the results and present them"></textarea>
            <div class="hint">These instructions will be included in SKILL.md and guide Claude's behavior</div>
        </div>
        
        <div class="section-title">📁 Folder Structure</div>
        
        <div class="form-group">
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="createScripts" checked>
                    <span>📜 scripts/ (Python/JS scripts)</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="createData">
                    <span>📊 data/ (CSV, JSON, etc.)</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="createExamples" checked>
                    <span>📁 examples/ (Usage examples)</span>
                </label>
            </div>
        </div>
        
        <div class="preview" id="preview">
            <h3>📂 Preview</h3>
            <div class="preview-content" id="previewContent">
my-awesome-skill/
├── SKILL.md
├── scripts/
│   └── main.py
└── examples/
    └── example.md
            </div>
        </div>
        
        <div class="button-group">
            <button type="submit" class="btn-primary">✨ Create Skill</button>
            <button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
        </div>
    </form>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const form = document.getElementById('skillForm');
        const displayNameInput = document.getElementById('displayName');
        const nameInput = document.getElementById('name');
        const descriptionInput = document.getElementById('description');
        const categoryInput = document.getElementById('category');
        const instructionsInput = document.getElementById('instructions');
        const createScriptsInput = document.getElementById('createScripts');
        const createDataInput = document.getElementById('createData');
        const createExamplesInput = document.getElementById('createExamples');
        const previewContent = document.getElementById('previewContent');
        const cancelBtn = document.getElementById('cancelBtn');
        
        // Auto-generate skill ID from display name
        displayNameInput.addEventListener('input', () => {
            const id = displayNameInput.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            nameInput.value = id;
            updatePreview();
        });
        
        // Update preview on any change
        [nameInput, createScriptsInput, createDataInput, createExamplesInput].forEach(el => {
            el.addEventListener('change', updatePreview);
            el.addEventListener('input', updatePreview);
        });
        
        function updatePreview() {
            const name = nameInput.value || 'my-skill';
            let tree = name + '/\\n├── SKILL.md';
            
            if (createScriptsInput.checked) {
                tree += '\\n├── scripts/\\n│   └── main.py';
            }
            if (createDataInput.checked) {
                tree += '\\n├── data/\\n│   └── .gitkeep';
            }
            if (createExamplesInput.checked) {
                tree += '\\n└── examples/\\n    └── example.md';
            }
            
            previewContent.textContent = tree.replace(/\\\\n/g, '\\n');
        }
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            vscode.postMessage({
                command: 'createSkill',
                data: {
                    name: nameInput.value,
                    displayName: displayNameInput.value,
                    description: descriptionInput.value,
                    category: categoryInput.value,
                    instructions: instructionsInput.value,
                    createScripts: createScriptsInput.checked,
                    createData: createDataInput.checked,
                    createExamples: createExamplesInput.checked
                }
            });
        });
        
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        // Initial preview
        updatePreview();
    </script>
</body>
</html>`;
    }
    dispose() {
        SkillWizardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.SkillWizardPanel = SkillWizardPanel;
//# sourceMappingURL=skillWizard.js.map