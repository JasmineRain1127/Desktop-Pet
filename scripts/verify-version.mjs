import { readFileSync } from "node:fs";
import process from "node:process";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const tauriConfig = JSON.parse(
  readFileSync("src-tauri/tauri.conf.json", "utf8")
);
const cargoManifest = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = readCargoPackageVersion(cargoManifest);

const versions = {
  "package.json": packageJson.version,
  "src-tauri/Cargo.toml": cargoVersion,
  "src-tauri/tauri.conf.json": tauriConfig.version
};
const expectedVersion = packageJson.version;

if (!expectedVersion || !isSemver(expectedVersion)) {
  fail(`package.json contains an invalid semantic version: ${expectedVersion}`);
}

for (const [file, version] of Object.entries(versions)) {
  if (version !== expectedVersion) {
    fail(`${file} has version ${version ?? "<missing>"}; expected ${expectedVersion}`);
  }
}

const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "";

if (tag && tag !== `v${expectedVersion}`) {
  fail(`release tag ${tag} does not match project version v${expectedVersion}`);
}

console.log(`Project version is consistent: ${expectedVersion}`);

function isSemver(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    version
  );
}

function readCargoPackageVersion(manifest) {
  let isPackageSection = false;

  for (const line of manifest.split(/\r?\n/)) {
    const section = line.match(/^\[([^\]]+)\]\s*$/)?.[1];

    if (section) {
      isPackageSection = section === "package";
      continue;
    }

    if (isPackageSection) {
      const version = line.match(/^version\s*=\s*"([^"]+)"\s*$/)?.[1];

      if (version) {
        return version;
      }
    }
  }

  return undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
