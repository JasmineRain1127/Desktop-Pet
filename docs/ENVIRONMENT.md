# 开发环境说明

## 环境管理原则

这个项目采用“工具全局安装，语言版本项目内锁定”的方式：

- Homebrew 只负责安装版本管理工具。
- Node.js 使用 `fnm` 管理。
- Rust 使用 `rustup` 管理。
- 项目通过 `.node-version` 固定 Node 版本。
- 项目通过 `rust-toolchain.toml` 固定 Rust 版本。
- npm 通过 `package-lock.json` 锁定依赖版本。

这样可以避免不同项目之间互相污染，也方便以后在新机器上恢复环境。

## 当前已安装工具

已通过 Homebrew 安装：

```bash
brew install fnm rustup-init
```

当前项目锁定版本：

```text
Node.js: 24.15.0
npm: 11.12.1
Rust: 1.95.0
Cargo: 1.95.0
```

## 进入项目环境

如果你的 shell 已经配置过 `fnm` 和 `cargo`，进入项目目录后通常可以直接使用。

如果还没有配置，可以在当前终端临时执行：

```bash
eval "$(/opt/homebrew/bin/fnm env --use-on-cd)"
source "$HOME/.cargo/env"
```

然后确认版本：

```bash
node -v
npm -v
rustc --version
cargo --version
```

项目里的 `npm run tauri` 命令会自动把 `$HOME/.cargo/bin` 补进 PATH，所以启动桌面应用时通常不需要手动 `source "$HOME/.cargo/env"`。

推荐启动方式：

```bash
/opt/homebrew/bin/fnm exec npm run tauri dev
```

如果你的终端已经启用了 `fnm`，也可以直接运行：

```bash
npm run tauri dev
```

期望看到：

```text
v24.15.0
11.12.1
rustc 1.95.0
cargo 1.95.0
```

## 为什么不用 Brew 直接安装 Node 和 Rust

不建议用 Homebrew 直接管理具体语言版本，原因是：

- Node.js 不同项目可能需要不同 LTS 版本。
- Rust 项目经常需要固定 toolchain 或额外 target。
- Tauri 项目同时涉及前端和 Rust 后端，版本漂移会很烦。

所以 Homebrew 只装 `fnm` 和 `rustup`，具体语言版本交给它们管理。

## npm 包管理策略

第一版先使用 npm：

- 简单直接。
- 和 Vite/Tauri 脚手架兼容好。
- `package-lock.json` 可以锁定依赖树。

当前 `.npmrc` 设置：

```text
save-exact=true
```

这样新增依赖时会保存精确版本，减少依赖版本漂移。

后续如果依赖规模变大，可以再迁移到 pnpm。

## 后续初始化 Tauri 项目

环境准备好后，下一步是初始化项目骨架：

```bash
npm create vite@latest
npm install
npm install @tauri-apps/cli @tauri-apps/api
```

然后初始化 Tauri：

```bash
npm run tauri init
```

具体命令可以根据最终项目结构微调。
