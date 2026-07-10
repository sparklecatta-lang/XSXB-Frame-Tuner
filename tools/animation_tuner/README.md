# XSXB Frame Tuner Webapp

这里是 XSXB Frame Tuner 的本地网页工作台。根目录 README 面向用户说明安装和使用；这个文件只记录 Webapp 的边界。

Webapp 本身不内置角色素材。项目选择器会读取当前本机生成的项目 registry，并把每个项目的 manifest、tuning、帧音效、图片挂件和 workspace assets 隔离存放。

默认入口：

```powershell
node tools\animation_tuner\server.js
```

默认地址：

```text
http://127.0.0.1:5179
```

常规工作流建议交给 `skills/xsxb-frame-tuner`：由 Agent 绑定 Godot 项目、批量导入 PNG 序列或 SpriteFrames、生成框体、同步并连接完整 runtime、运行严格验证，然后打开这个 Webapp 给人调参。
