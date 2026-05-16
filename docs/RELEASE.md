# Windows 试用版发布流程

这份文档用于发布“给熟人试用”的 Windows 免安装版本。当前阶段只发布 `.exe`，不做 MSI/NSIS 安装包，也不做代码签名。

## 发布目标

- 让试用者可以下载并直接运行 `desktop-pet.exe`
- 保持发布流程简单，不要求本地 Windows 虚拟机
- 每次发布前都有明确的检查清单
- 遇到问题时可以快速回滚到上一个可用版本

## 发布前检查

在本地确认源码没有明显问题：

```bash
/opt/homebrew/bin/fnm exec npm run build
/Users/jasmine/.cargo/bin/cargo fmt --check
/Users/jasmine/.cargo/bin/cargo check
/Users/jasmine/.cargo/bin/cargo clippy -- -D warnings
```

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

## 下载 Windows exe

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

把 `desktop-pet.exe` 放到一台真实 Windows 10/11 机器上测试：

- 双击能启动
- 托盘图标出现
- 小怪兽窗口出现
- 小怪兽可以拖动
- 退出重开后窗口位置能恢复
- 托盘「重置位置」可用
- 托盘「显示小怪兽」「隐藏小怪兽」可用
- 托盘「投喂」能打开投喂窗口
- 拖文件投喂后小怪兽有反应
- 空闲一段时间后状态会变困或睡觉
- 正常打字不会频繁过载
- 退出后进程消失

如果 Windows 弹出未知发布者或安全提醒，这是当前未签名试用版的预期现象。确认文件来自自己的 GitHub Actions 后再继续运行。

## 发给试用者

建议只发给可信试用者，并附上这些说明：

```text
这是桌面小怪兽的试用版，目前是免安装 exe。

使用方式：
1. 解压 desktop-pet-windows-exe.zip
2. 双击 desktop-pet.exe
3. 右下角托盘图标可以显示、隐藏、投喂和退出

注意：
- 目前还没有正式安装包和代码签名，Windows 可能会提示未知发布者
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

## 暂不做的事情

当前 7A 阶段不处理：

- MSI/NSIS 安装包
- 代码签名
- 自动更新
- Microsoft Store 发布
- 多语言安装器

这些放到 7B 或后续正式发布阶段处理。
