// dsh-skill-pack 安装器：把包内 skills/ 安装到目标技能目录（默认 ~/.dsh/skills）
// 安全语义：只复制（新增/覆盖同名），绝不删除目标里的任何东西——
// 目标目录可能已有第三方技能（anthropics/superpowers 系），删除会毁用户数据。
// 用法: npx dsh-skill-pack install [目标目录]   （--force 覆盖已存在，默认跳过提示）
import { readdirSync, cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsSrc = join(pkgRoot, "skills");
const args = process.argv.slice(2);
const force = args.includes("--force");
const dest = args.filter((a) => !a.startsWith("--"))[0] || join(homedir(), ".dsh", "skills");

if (!existsSync(skillsSrc)) { console.error("包内 skills/ 缺失（包损坏？）"); process.exit(1); }
mkdirSync(dest, { recursive: true });

const dirs = readdirSync(skillsSrc, { withFileTypes: true }).filter((d) => d.isDirectory());
let installed = 0, skipped = 0;
for (const d of dirs) {
  const target = join(dest, d.name);
  if (existsSync(target) && !force) { skipped++; continue; }
  cpSync(join(skillsSrc, d.name), target, { recursive: true });
  installed++;
}
console.log(`dsh-skill-pack: 安装 ${installed} 个到 ${dest}（跳过已存在 ${skipped} 个；--force 覆盖）`);
console.log(`提示：安装后重启 DSH（技能目录在启动时扫描）。`);
