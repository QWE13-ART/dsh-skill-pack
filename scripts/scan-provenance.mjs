// 一次性扫描：技能目录来源标记（发布前合规圈定用）
// 用法: node scan-provenance.mjs <skills根目录>
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || join(process.env.USERPROFILE, ".dsh", "skills");
const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
const PAT = /(anthropics\/skills|github\.com\/obra|superpowers|anthropic 官方|antirez|obra\.site|source:\s*https?:\/\/|author:\s+[A-Z][a-z]+|CC BY-NC|zed-industries)/i;

let flagged = 0;
for (const d of dirs) {
  const sk = join(root, d.name, "SKILL.md");
  if (!existsSync(sk)) continue;
  const raw = readFileSync(sk, "utf8");
  const head = raw.slice(0, 6000); // 只扫头部（frontmatter + 开场）
  const m = head.match(PAT);
  if (m) {
    flagged++;
    console.log(`${d.name}: [${m[0].trim().slice(0, 60)}]`);
  }
}
console.log(`\n命中 ${flagged}/${dirs.length}（matched/total 自曝）`);
