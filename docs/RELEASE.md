# Windows 0.2 试用与发布流程

这份文档用于发布 Windows 便携版和 NSIS 安装版。当前仍不做代码签名或应用内自动更新；Alpha/Beta 必须先经过真机测试。

## 发布目标

- 让试用者可以选择便携版或当前用户范围的 NSIS 安装版
- 同时生成 SHA-256 校验文件
- 保持发布流程简单，不要求本地 Windows 虚拟机
- 每次发布前都有明确的检查清单
- 遇到问题时可以快速回滚到上一个可用版本

## 发布前检查

在本地确认源码没有明显问题：

```bash
/opt/homebrew/bin/fnm exec npm run check
/opt/homebrew/bin/fnm exec npm run security:audit
```

该命令会运行前端测试与构建，以及 Rust 格式检查、编译检查、单元测试和 Clippy。

如果改过 Tauri、Rust 或窗口行为，建议再跑一次无安装包构建：

```bash
/opt/homebrew/bin/fnm exec npm run tauri -- build --no-bundle
```

## 合并到 main

1. 将当前功能分支 push 到 GitHub
2. 创建 Pull Request
3. 确认 Windows Build 检查通过
4. 合并 Pull Request 到 `main`
5. 等 `main` 上的 Windows Build 再跑一次

不要在 CI 红灯时发试用版。

## 生成候选发布包

在 GitHub Actions 手动运行 `Windows Release`。成功后下载 `desktop-pet-windows-<version>`，其中包含：

```text
Desktop-Pet_<version>_x64-portable.exe
Desktop-Pet_<version>_x64-setup.exe
SHA256SUMS.txt
```

先按校验文件验证两个 EXE，再开始真机测试。日常 `Windows Build` 的 `desktop-pet-windows-exe` 仍可用于更快的便携版冒烟。

## 下载日常 Windows exe

1. 打开 GitHub 仓库页面
2. 点击 `Actions`
3. 进入最新成功的 `Windows Build`
4. 在页面底部找到 `Artifacts`
5. 下载 `desktop-pet-windows-exe`
6. 解压后得到 `desktop-pet.exe`

产物对应路径：

```text
src-tauri/target/release/desktop-pet.exe
```

## 本机冒烟测试

正式进入两轮试用时，使用 [`docs/ALPHA_TEST.md`](ALPHA_TEST.md) 记录环境、完整清单和问题等级。下面是每个候选包都必须先通过的最小冒烟测试。

把便携版和安装版放到一台真实 Windows 10/11 机器上测试：

- 双击能启动
- 托盘图标出现
- 小怪兽窗口出现
- 小怪兽可以拖动
- 退出重开后窗口位置能恢复
- 托盘「重置位置」可用
- 托盘「显示小怪兽」「隐藏小怪兽」可用
- 托盘「投喂」能打开投喂窗口
- 拖文件投喂后小怪兽有反应
- 托盘和设置页都能进入、退出安静模式
- 关闭 CPU、空闲或打字检测后，调试面板显示对应指标已关闭
- 开启鼠标穿透后，可从托盘恢复鼠标交互
- 开机启动开启、重启验证和再次关闭均正常
- 设置窗口修改形象或开关后，主窗口立即同步且重启后保留
- 「恢复默认并清除本地数据」会关闭开机启动和鼠标穿透、恢复默认形象并重置窗口位置
- 空闲一段时间后状态会变困或睡觉
- 正常打字不会频繁过载
- 退出后进程消失
- NSIS 可在无管理员权限的当前用户范围安装
- 安装后开始菜单快捷方式、启动和卸载均正常
- 同版本覆盖安装不会丢失设置，旧版本不能覆盖新版本
- 便携版与安装版不会产生无法退出的重复进程

如果 Windows 弹出未知发布者或安全提醒，这是当前未签名试用版的预期现象。确认文件来自自己的 GitHub Actions 后再继续运行。

## 发给试用者

建议只发给可信试用者，并附上这些说明：

```text
这是桌面小怪兽 0.2 的试用版，包含便携版和安装版。

使用方式：
1. 便携使用：运行名称含 portable 的 exe
2. 安装使用：运行名称含 setup 的 exe
3. 右下角托盘图标可以显示、隐藏、投喂和退出

注意：
- 当前没有代码签名，Windows 可能会提示未知发布者
- 它只统计打字速度，不读取你打了什么
- 投喂文件时只读取文件名、后缀、大小、修改时间，不读取文件内容
- 遇到问题可以截图或描述复现步骤
```

## 版本记录建议

每次给别人试用前，建议在 GitHub 创建一个 Release 或至少记录：

- 日期
- 对应 commit SHA
- 试用对象
- 主要新增功能
- 已知问题

示例：

```text
2026-05-16 internal-test-01
commit: <commit-sha>
内容：窗口拖动、位置记忆、真实 CPU/空闲/打字速度、投喂
已知问题：未签名，无正式安装包
```

## 标签与 GitHub Release

只有完成两轮试用并确认版本号后才创建标签：

```bash
npm run version:check
git tag v0.2.0
git push origin v0.2.0
```

标签必须与 `package.json`、`Cargo.toml` 和 `tauri.conf.json` 的版本完全一致。标签触发的 `Windows Release` 会自动创建 GitHub Release；预发布版本会标记为 prerelease。

## 暂不做的事情

当前 7A 阶段不处理：

- 代码签名
- 自动更新
- Microsoft Store 发布
- MSI 安装包

这些留到 0.2 发布后的迭代处理。
