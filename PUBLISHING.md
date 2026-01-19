# Antigravity Skill Manager 发布指南

本文档介绍如何将本扩展发布到 Open VSX Registry (Antigravity 默认使用的扩展市场)。

## 前置准备

1.  **创建 Open VSX 账号**: 访问 [open-vsx.org](https://open-vsx.org/) 并使用 GitHub 登录。
2.  **创建 Namespace**: 在 Settings 页面创建一个 Namespace（建议与 `package.json` 中的 `publisher` 字段一致，当前为 `Glasser`）。
3.  **获取 Token**: 在 Settings -> Access Tokens 中生成一个新的 Token。

## 发布步骤

### 1. 修改 Publisher (如果需要)
如果你不是 `Glasser` 组织的成员，请将 `package.json` 中的 `"publisher": "Glasser"` 修改为你自己的 Open VSX namespace。

### 2. 安装 `ovsx` 工具
`ovsx` 是 Open VSX 的命令行发布工具（类似于 `vsce`）。

```bash
npm install -g ovsx
```

### 3. 打包和发布

```bash
# 登录 (或在发布命令中使用 -p <token>)
ovsx login <publisher>

# 发布 (自动打包并上传)
ovsx publish
```

或者使用 Token 直接发布：

```bash
ovsx publish -p <YOUR_ACCESS_TOKEN>
```

### 4. 验证
发布成功后，访问 `https://open-vsx.org/extension/<publisher>/antigravity-skill-manager` 查看扩展页面。

## 发布到 VS Code Marketplace (可选)

如果你也想发布到微软官方 VS Code 商店：

1.  安装 `vsce`: `npm install -g vsce`
2.  创建 [Azure DevOps 组织和 Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token)。
3.  创建 Publisher: `vsce create-publisher <publisher>`
4.  登录: `vsce login <publisher>`
5.  发布: `vsce publish`

## 本地测试 (生成 .vsix)

如果不发布，只是想在本地生成安装包分享给别人：

```bash
npx vsce package
```
这会生成一个 `.vsix` 文件。用户可以通过 "Install from VSIX..." 来安装。
