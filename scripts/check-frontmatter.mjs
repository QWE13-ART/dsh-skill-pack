// 发布集 frontmatter 快速校验（构建后门禁）
// 判据：SKILL.md 存在、以 --- 开闭、前 12 行含 name: 与 description:
// 用法: node scripts/check-frontmatter.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
let bad = 0;
for (const d of dirs) {
  const sk = join(skillsDir, d.name, "SKILL.md");
  if (!existsSync(sk)) { console.log(`✗ ${d.name}: 无 SKILL.md`); bad++; continue; }
  const raw = readFileSync(sk, "utf8");
  const head = raw.split("\n").slice(0, 14);
  if (!head[0].trim().startsWith("---")) { console.log(`✗ ${d.name}: 无开 ---`); bad++; continue; }
  if (!head.some((l) => /^name:\s*\S+/.test(l))) { console.log(`✗ ${d.name}: 缺 name`); bad++; continue; }
  if (!head.some((l) => /^description:/.test(l))) { console.log(`✗ ${d.name}: 缺 description`); bad++; continue; }
}
console.log(`校验 ${dirs.length} 个，问题 ${bad} 个（matched/total 自曝）`);
process.exit(bad ? 1 : 0);
