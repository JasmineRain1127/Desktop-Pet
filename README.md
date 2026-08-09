# 桌面小怪兽

一个常驻桌面的 Windows 小宠物。它会根据电脑负载、空闲时间和打字速度改变心情，也可以通过拖入文件进行“投喂”。

项目当前正在从试用原型推进到功能完善版，目标是先完成 Windows 真机验收和两轮内部试用，再提供正式安装包。

## 已实现功能

- 透明、无边框、置顶的小怪兽窗口
- 小怪兽窗口可拖动，并会记住上次位置
- 系统托盘菜单：显示、隐藏、投喂、设置、安静模式、鼠标穿透、调试面板、重置位置、退出
- 自动心情状态：发呆、专注、紧张、过载、犯困、睡觉
- 真实 CPU 使用率采样
- 真实用户空闲时长检测
- 真实打字速度采样，只统计速度，不读取输入内容
- 自动心情切换带轻量防抖；CPU 或打字信号持续过高 10 秒才进入过载，睡觉和醒来仍即时响应
- 文件投喂窗口：拖入文件后根据文件元信息给出反应
- 点击状态胶囊可快速切换小怪兽、小猫、小狗三种桌宠形象，设置窗口内也可选择，并会在本机记住上次选择
- 设置窗口可控制安静模式、CPU/空闲/打字检测、鼠标穿透和开机启动
- 安静模式会暂停系统采样和普通循环动画，投喂反应仍可使用
- 应用设置统一保存在本机配置目录，并会迁移旧版外观选择
- GitHub Actions 自动构建 Windows 便携版 `.exe`、NSIS 安装包和 SHA-256 校验文件

## 隐私说明

这个项目的目标是做一个可爱的桌面小玩具，不是监控工具。

当前实现遵守这些边界：

- 不读取键盘输入内容
- 不保存键盘输入内容
- 不读取被投喂文件的正文内容
- 不上传 CPU、键盘、空闲、文件等任何数据
- 投喂功能只读取文件名、后缀、大小、修改时间等基础元信息
- 桌宠形象和行为设置只保存在本机应用配置目录中，不会上传

## 本地开发

推荐使用项目锁定的 Node.js 和 Rust 版本。

```bash
/opt/homebrew/bin/fnm exec npm install
/opt/homebrew/bin/fnm exec npm run tauri dev
```

常用检查命令：

```bash
/opt/homebrew/bin/fnm exec npm run check
/opt/homebrew/bin/fnm exec npm run security:audit
```

如果需要分开定位问题，可以单独运行：

```bash
/opt/homebrew/bin/fnm exec npm run check
/Users/jasmine/.cargo/bin/cargo fmt --check
/Users/jasmine/.cargo/bin/cargo check
/Users/jasmine/.cargo/bin/cargo clippy -- -D warnings
```

更多环境说明见 [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)。

## Windows 试用版下载

当前版本为 `0.2.0-alpha.1`。功能冒烟优先使用免安装 `.exe`；安装流程测试使用 `Windows Release` 产出的 NSIS 安装包：

1. 进入 GitHub Actions，选择 `Windows Build` 或 `Windows Release`
2. `Windows Build` 提供日常便携版 `desktop-pet.exe`
3. `Windows Release` 提供带版本号的便携版、NSIS 安装包和 `SHA256SUMS.txt`
4. 公开发布只允许从 `v<项目版本>` 标签触发；版本不一致会直接失败

详细发布流程见 [docs/RELEASE.md](docs/RELEASE.md)，Windows 构建说明见 [docs/WINDOWS_BUILD.md](docs/WINDOWS_BUILD.md)。

## 当前限制

- NSIS 安装包已能自动生成，仍等待 Windows 真机安装、升级和卸载验收
- 暂未做代码签名，Windows 可能会显示安全提醒
- 仍需在真实 Windows 10/11 机器上做完整手动验收
- 调试面板仍作为开发入口保留在托盘菜单中
- 设置文件损坏时会回退到默认值并提示修复；跨显示器恢复会校验窗口是否仍在可见屏幕内
- 前端与 Rust 核心逻辑已接入自动化测试，并纳入 Windows CI 门禁

## 后续计划

- 整理首版试用反馈
- 完成统一设置和传感器控制的 Windows 真机验收
- 在 Windows 真机上验证设置损坏恢复、多显示器变化和持续过载判定
- 完成 NSIS 安装、升级、卸载与便携版并存测试
- 研究代码签名和更友好的 Windows 下载体验
