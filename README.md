# Card → ChatGPT for MarginNote 4

在 MarginNote 4 里点击一张卡片，自动把卡片排版成图片并放入右侧 ChatGPT 网页输入框。

无需复制文字、无需 OpenAI API Key，图片只会进入输入框，不会自动发送。

![卡片图片生成示例](docs/images/card-preview.png)

## 功能

- 左侧插件按钮一键开启或暂停卡片监听；
- 点击卡片后自动弹出右侧 ChatGPT 网页；
- 提取卡片标题、摘录、文字批注、卡内图片和关联内容；
- 将长卡片自动排版为一张或多张 PNG；
- 自动把图片附加到 ChatGPT 输入框；
- 默认尝试开启 ChatGPT 临时聊天；
- 保留输入框焦点，等待用户补充问题并手动发送；
- 关闭右侧面板后监听仍然保持开启。

## 运行要求

- MarginNote 4.0 或更高版本；
- macOS 或支持 MarginNote 4 插件的设备；
- 可以在内嵌网页中正常访问并登录 ChatGPT。

## 安装

1. 下载仓库中的 [`dist/CardAskGPT.mnaddon`](dist/CardAskGPT.mnaddon)；
2. 双击安装包并允许 MarginNote 4 覆盖/加载插件；
3. 重新打开 MarginNote 4；
4. 打开一个学习集；
5. 点击左侧插件栏中的 **Card → ChatGPT** 按钮；
6. 首次使用时，在右侧内嵌网页登录 ChatGPT。

看到“Card → ChatGPT 已开启”后，点击任意卡片即可。

## 应用示例

假设当前卡片是“数据库事务的隔离性”：

1. 在脑图中单击这张卡片；
2. 插件在右侧打开 ChatGPT；
3. 插件把卡片内容排版成图片并附加到输入框；
4. 在图片后输入问题，例如：

   ```text
   请用一个转账失败的例子解释这张卡片，并指出容易混淆的概念。
   ```

5. 检查图片和问题后，手动点击发送。

插件只负责准备上下文，不会替用户发送消息。

## 临时聊天

右侧面板顶部的“临时：开/关”用于保存默认偏好：

- **临时：开**：插件会尝试进入 ChatGPT 临时聊天；
- **临时：关**：使用普通聊天页面；
- 如果 ChatGPT 网页改版导致入口无法识别，插件会提示用户手动开启；
- 临时聊天行为和数据保留规则以 ChatGPT 网页当前说明为准。

## 工作流程

```text
点击 MarginNote 卡片
        ↓
读取标题、摘录、批注和图片
        ↓
在 ChatGPT 网页中生成 PNG
        ↓
打开/复用右侧 ChatGPT 面板
        ↓
将 PNG 附加到输入框
        ↓
用户补充问题并手动发送
```

## 隐私说明

- 插件不调用 OpenAI API；
- 插件不需要也不读取 OpenAI API Key；
- 卡片内容只会通过用户已登录的 ChatGPT 网页上传；
- 图片附加后不会自动发送；
- 使用临时聊天前，请自行确认 ChatGPT 当前的数据处理说明。

## 已知限制

- ChatGPT 网页 DOM 变化后，自动附图或临时聊天识别可能需要更新；
- HTML 批注按纯文本渲染，复杂富文本外观可能与 MarginNote 略有差异；
- 极长卡片会拆分成多张图片；
- 当前只监听脑图卡片点击，不监听文档选区；
- 本项目目前是未签名的开发版插件。

## 开发

项目不依赖 npm 包，使用系统自带的 Node.js 和 shell 工具即可：

```bash
./scripts/test.sh
./scripts/build.sh
```

构建产物：

```text
dist/CardAskGPT.mnaddon
```

## 项目结构

```text
assets/icon.svg             插件图标源文件
docs/images/                README 示例图片
src/main.js                 生命周期、开关与卡片监听
src/panel.js                右侧 ChatGPT 面板
src/chatgptBridge.js        图片渲染与网页文件注入
src/mnaddon.json            MarginNote 插件清单
scripts/build.sh            打包脚本
scripts/test.sh             测试脚本
tests/bridge.test.js        网页注入结构测试
tests/mock-chatgpt.html     本地 ChatGPT 模拟页面
```

## 当前版本

`v0.1.3`
