import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import process from "node:process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Missing command.");
  process.exit(1);
}

const env = { ...process.env };
const pathKey = findPathKey(env);
const projectBin = join(process.cwd(), "node_modules", ".bin");
const localBinCommand = join(
  projectBin,
  process.platform === "win32" ? `${command}.cmd` : command
);
const resolvedCommand = existsSync(localBinCommand) ? localBinCommand : command;
const pathParts = [projectBin];
const homeDir = env.HOME ?? env.USERPROFILE;
const cargoHome = env.CARGO_HOME ?? (homeDir ? join(homeDir, ".cargo") : undefined);

if (cargoHome) {
  const cargoBin = join(cargoHome, "bin");

  if (existsSync(cargoBin)) {
    pathParts.push(cargoBin);
  }
}

pathParts.push(env[pathKey] ?? "");
env[pathKey] = pathParts.join(delimiter);

if (process.platform === "win32") {
  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toLowerCase() === "path") {
      delete env[key];
    }
  }
}

const result = spawnSync(resolvedCommand, args, {
  env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function findPathKey(environment) {
  if (process.platform !== "win32") {
    return "PATH";
  }

  return Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
}
