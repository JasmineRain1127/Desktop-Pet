import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import process from "node:process";

const env = buildProjectEnv();
const checks = [
  {
    label: "frontend tests",
    command: "npm",
    args: ["run", "test:run"]
  },
  {
    label: "frontend build",
    command: "npm",
    args: ["run", "build"]
  },
  {
    label: "cargo fmt",
    command: "cargo",
    args: ["fmt", "--check"],
    cwd: "src-tauri"
  },
  {
    label: "cargo check",
    command: "cargo",
    args: ["check"],
    cwd: "src-tauri"
  },
  {
    label: "cargo test",
    command: "cargo",
    args: ["test"],
    cwd: "src-tauri"
  },
  {
    label: "cargo clippy",
    command: "cargo",
    args: ["clippy", "--", "-D", "warnings"],
    cwd: "src-tauri"
  }
];

for (const check of checks) {
  console.log(`\n> ${check.label}`);

  const result = spawnSync(resolveCommand(check.command), check.args, {
    cwd: check.cwd ? join(process.cwd(), check.cwd) : process.cwd(),
    env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildProjectEnv() {
  const nextEnv = { ...process.env };
  const pathKey = findPathKey(nextEnv);
  const pathParts = [join(process.cwd(), "node_modules", ".bin")];
  const homeDir = nextEnv.HOME ?? nextEnv.USERPROFILE;
  const cargoHome =
    nextEnv.CARGO_HOME ?? (homeDir ? join(homeDir, ".cargo") : undefined);

  if (cargoHome) {
    const cargoBin = join(cargoHome, "bin");

    if (existsSync(cargoBin)) {
      pathParts.push(cargoBin);
    }
  }

  pathParts.push(nextEnv[pathKey] ?? "");
  nextEnv[pathKey] = pathParts.join(delimiter);

  if (process.platform === "win32") {
    for (const key of Object.keys(nextEnv)) {
      if (key !== pathKey && key.toLowerCase() === "path") {
        delete nextEnv[key];
      }
    }
  }

  return nextEnv;
}

function resolveCommand(command) {
  const localBinCommand = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${command}.cmd` : command
  );

  return existsSync(localBinCommand) ? localBinCommand : command;
}

function findPathKey(environment) {
  if (process.platform !== "win32") {
    return "PATH";
  }

  return (
    Object.keys(environment).find((key) => key.toLowerCase() === "path") ??
    "PATH"
  );
}
