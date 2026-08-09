# Windows 构建说明

本项目不需要在 macOS 本机安装 Windows 虚拟机。Windows 可执行文件由 GitHub Actions 的 `windows-latest` runner 构建。

## 前提

- GitHub 仓库使用 SSH remote，例如：

```bash
git remote -v
```

应看到类似：

```text
origin  git@github.com:JasmineRain1127/Desktop-Pet.git (fetch)
origin  git@github.com:JasmineRain1127/Desktop-Pet.git (push)
```

- 本地代码已经 push 到 GitHub。

## 自动构建

`.github/workflows/windows-build.yml` 会在以下场景运行：

- push 到 `main`
- 给 `main` 发起 pull request
- 在 GitHub Actions 页面手动点击 `Run workflow`

流程会依次执行：

```bash
npm ci
npm run check
npm run security:audit
npm run tauri -- build --no-bundle
```

## 下载产物

构建完成后：

1. 打开 GitHub 仓库页面
2. 进入 `Actions`
3. 选择 `Windows Build`
4. 打开成功的 workflow run
5. 在 `Artifacts` 里下载 `desktop-pet-windows-exe`

产物来自：

```text
src-tauri/target/release/desktop-pet.exe
```

日常 `Windows Build` 只上传可运行的 `.exe`，避免安装器链路阻塞快速反馈。

`.github/workflows/windows-release.yml` 是候选发布流程。手动运行时会生成：

- `Desktop-Pet_<version>_x64-portable.exe`
- `Desktop-Pet_<version>_x64-setup.exe`（NSIS，当前用户安装）
- `SHA256SUMS.txt`

推送与项目版本一致的 `v<version>` 标签时，该流程还会创建 GitHub Release。带连字符的版本（例如 `v0.2.0-alpha.1`）会自动标记为预发布。

如果要把试用版发给别人，请先按照 [RELEASE.md](RELEASE.md) 做一次真实 Windows 冒烟测试。

## 产物保留时间

GitHub Actions artifact 不是永久网盘。当前 workflow 会保留 Windows `.exe` 产物一段时间，适合内部试用和临时下载。

如果某个版本需要长期留存，应通过版本标签触发 `Windows Release`，由流程上传安装包、便携版和校验文件。

## 本地开发与 Windows 打包的区别

macOS 本地仍然使用：

```bash
/opt/homebrew/bin/fnm exec npm run tauri dev
```

Windows 打包不在本地执行，而是在 GitHub Actions 中执行：

```bash
npm run tauri -- build --no-bundle
```

这样可以避免虚拟机，也能尽早验证 Windows 专属代码，例如：

- `GetLastInputInfo`
- `GetAsyncKeyState`
- Tauri Windows 可执行文件构建

## 如果构建失败

先看失败步骤：

- `npm ci`：通常是 lockfile 或 Node 版本问题
- `npm run check`：通常是版本不一致、测试、TypeScript、Rust 格式或编译问题
- `npm run security:audit`：npm 依赖出现已知高危漏洞
- `npm run tauri -- build --no-bundle`：通常是 Tauri Windows release 编译问题
- `npm run tauri -- build --bundles nsis`：通常是 NSIS 配置或安装包生成问题

把失败日志贴回来即可继续修。
