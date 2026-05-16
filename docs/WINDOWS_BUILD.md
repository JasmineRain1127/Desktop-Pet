# Windows 构建说明

本项目不需要在 macOS 本机安装 Windows 虚拟机。Windows 安装包由 GitHub Actions 的 `windows-latest` runner 构建。

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
npm run build
cargo check
npm run tauri -- build
```

## 下载产物

构建完成后：

1. 打开 GitHub 仓库页面
2. 进入 `Actions`
3. 选择 `Windows Build`
4. 打开成功的 workflow run
5. 在 `Artifacts` 里下载 `desktop-pet-windows`

产物来自：

```text
src-tauri/target/release/bundle/
```

通常会包含 Windows 安装包，例如 `.msi` 或 `.exe`，具体取决于 Tauri 在 Windows runner 上生成的 bundle 类型。

## 本地开发与 Windows 打包的区别

macOS 本地仍然使用：

```bash
/opt/homebrew/bin/fnm exec npm run tauri dev
```

Windows 打包不在本地执行，而是在 GitHub Actions 中执行：

```bash
npm run tauri -- build
```

这样可以避免虚拟机，也能尽早验证 Windows 专属代码，例如：

- `GetLastInputInfo`
- `GetAsyncKeyState`
- Tauri Windows bundle

## 如果构建失败

先看失败步骤：

- `npm ci`：通常是 lockfile 或 Node 版本问题
- `npm run build`：通常是 TypeScript 或前端构建问题
- `cargo check`：通常是 Rust 编译或 Windows API 调用问题
- `npm run tauri -- build`：通常是 Tauri bundler 或 Windows 打包问题

把失败日志贴回来即可继续修。
