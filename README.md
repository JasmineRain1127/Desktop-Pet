# 桌面小怪兽

一个常驻桌面的 Windows 小宠物。它会根据电脑负载、空闲时间和打字速度改变心情，也可以通过拖入文件进行“投喂”。

项目当前仍处于试用原型阶段，目标是先做出一个能发给熟人体验的轻量 `.exe`，后续再补正式安装包、签名和设置页。

## 已实现功能

- 透明、无边框、置顶的小怪兽窗口
- 小怪兽窗口可拖动，并会记住上次位置
- 系统托盘菜单：显示、隐藏、投喂、调试面板、重置位置、退出
- 自动心情状态：发呆、专注、紧张、过载、犯困、睡觉
- 真实 CPU 使用率采样
- 真实用户空闲时长检测
- 真实打字速度采样，只统计速度，不读取输入内容
- 文件投喂窗口：拖入文件后根据文件元信息给出反应
- GitHub Actions 自动构建 Windows `.exe`

## 隐私说明

这个项目的目标是做一个可爱的桌面小玩具，不是监控工具。

当前实现遵守这些边界：

- 不读取键盘输入内容
- 不保存键盘输入内容
- 不读取被投喂文件的正文内容
- 不上传 CPU、键盘、空闲、文件等任何数据
- 投喂功能只读取文件名、后缀、大小、修改时间等基础元信息

## 本地开发

推荐使用项目锁定的 Node.js 和 Rust 版本。

```bash
/opt/homebrew/bin/fnm exec npm install
/opt/homebrew/bin/fnm exec npm run tauri dev
```

常用检查命令：

```bash
/opt/homebrew/bin/fnm exec npm run build
/Users/jasmine/.cargo/bin/cargo fmt --check
/Users/jasmine/.cargo/bin/cargo check
/Users/jasmine/.cargo/bin/cargo clippy -- -D warnings
```

更多环境说明见 [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)。

## Windows 试用版下载

当前推荐先使用免安装 `.exe` 做内部试用：

1. 把代码合并到 `main`
2. 等 GitHub Actions 的 `Windows Build` 跑完
3. 进入成功的 workflow run
4. 在 `Artifacts` 下载 `desktop-pet-windows-exe`
5. 解压后运行 `desktop-pet.exe`

详细发布流程见 [docs/RELEASE.md](docs/RELEASE.md)，Windows 构建说明见 [docs/WINDOWS_BUILD.md](docs/WINDOWS_BUILD.md)。

## 当前限制

- 暂未提供正式安装包
- 暂未做代码签名，Windows 可能会显示安全提醒
- 仍需在真实 Windows 10/11 机器上做完整手动验收
- 调试面板仍作为开发入口保留在托盘菜单中

## 后续计划

- 整理首版试用反馈
- 增加“关于小怪兽”和隐私说明窗口
- 做正式安装包
- 研究代码签名和更友好的 Windows 下载体验
