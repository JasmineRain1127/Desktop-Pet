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
const pathParts = [];

if (env.HOME) {
  const cargoBin = join(env.HOME, ".cargo", "bin");

  if (existsSync(cargoBin)) {
    pathParts.push(cargoBin);
  }
}

pathParts.push(env.PATH ?? "");
env.PATH = pathParts.join(delimiter);

const result = spawnSync(command, args, {
  env,
  shell: process.platform === "win32",
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
