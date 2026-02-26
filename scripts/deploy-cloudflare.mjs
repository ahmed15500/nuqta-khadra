import { spawnSync } from "node:child_process";

const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CF_PAGES_PROJECT"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error("Missing required environment variables:");
  missing.forEach((key) => console.error(`- ${key}`));
  console.error("");
  console.error("Set them, then run: npm run deploy:cloud");
  process.exit(1);
}

const args = [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  "--project-name",
  process.env.CF_PAGES_PROJECT
];

if (process.env.CF_PAGES_BRANCH) {
  args.push("--branch", process.env.CF_PAGES_BRANCH);
}

const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
