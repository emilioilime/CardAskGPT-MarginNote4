# Card → ChatGPT for MarginNote 4

在 MarginNote 4 里点击一张卡片，自动把卡片排版成图片并放入右侧 ChatGPT 网页输入框。

无需复制文字、无需 OpenAI API Key，图片只会进入输入框，不会自动发送。

![卡片图片生成示例](docs/images/card-preview.png)

## 功能

- 左侧插件按钮一键开启或暂停卡片监听；
- 点击卡片后自动弹出右侧 ChatGPT 网页；
- 提取卡片标题、摘录、文字批注、卡内图片和关联内容；
- 每张卡片排版为一张完整 PNG；
- 单选时自动替换旧附件，输入框始终只保留当前卡片图片；
- 多选时同步当前选区，例如选中 3 张卡片就保留 3 张图片；
- 取消全部选中时自动清空输入框中的卡片图片，始终保持图片数等于选中数；
- 重复点击同一卡片不会不断累积附件；
- 默认尝试开启 ChatGPT 临时聊天；
- 拖动面板标题栏可调整窗口位置；
- 拖动右下角弧形把手可自由调整窗口宽度和高度；
- 自动保存面板最后的位置与尺寸；
- 静默执行同步、复制与切换操作，不显示 HUD 浮层提示；
- 保留 ChatGPT 复制内容中的 HTML、Markdown 与原始文本格式；
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

### 多选示例

1. 在 MarginNote 4 中开启多选模式；
2. 选中“原子性”“一致性”“隔离性”三张卡片；
3. 插件会先清理输入框中的旧卡片附件；
4. 输入框最终只保留这三张卡片对应的三张图片。

从多选切回单选时，三个旧附件也会自动替换为当前的一张。

## 临时聊天

右侧面板顶部的“临时：开/关”用于保存默认偏好：

- **临时：开**：插件会尝试进入 ChatGPT 临时聊天；
- **临时：关**：使用普通聊天页面；
- 切换开关后会立即进入对应页面，刷新按钮也会按当前开关重新打开正确模式；
- 如果 ChatGPT 网页改版导致入口无法识别，插件会提示用户手动开启；
- 临时聊天行为和数据保留规则以 ChatGPT 网页当前说明为准。

## 调整窗口

- 按住顶部 **Card → ChatGPT** 标题栏并拖动，可以移动整个窗口；
- 按住窗口右下角的弧形把手并拖动，可以同时调整宽度和高度；
- 窗口会保持在 MarginNote 可见区域内；
- 插件会保存最后的位置和尺寸，重新打开后自动恢复。

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
- 极长卡片会缩放到一张高图中，文字显示尺寸可能相应变小；
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
tests/selection.test.js     单选/多选同步结构测试
tests/temporary-mode.test.js 临时聊天模式切换测试
tests/clipboard.test.js     网页复制到系统剪贴板测试
tests/panel-frame.test.js   面板移动、缩放与边界测试
tests/no-hud.test.js        无 HUD 浮层提示测试
tests/mock-chatgpt.html     本地 ChatGPT 模拟页面
```

## 当前版本

`v0.1.9`
