// dsh-skill-pack 构建脚本：从 ~/.dsh/skills 复制「自研系」技能到发布仓 skills/
// 排除口径（2026-09-02 定案，scan-provenance.mjs 实证）：只发自研系——
// ① 正文/来源标记命中 anthropics/skills、superpowers/obra、Anthropic 官方（28 个）
// ② impeccable、design-taste-frontend（官方系但无 LICENSE 文件）
// 复制时过滤垃圾：.bak* 备份残留 / .gitkeep 占位
// 用法: node scripts/build-release.mjs [源skills根] [目标skills目录]
import { readdirSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EXCLUDED = new Set([
  // 来源标记 28（scan-provenance.mjs 实测命中）
  "dsh-algorithmic-art","dsh-anthropic-skill-creator","dsh-archify","dsh-brainstorming",
  "dsh-branch-finish","dsh-brand-guidelines","dsh-debugging","dsh-decomposing",
  "dsh-discernment-nudge","dsh-doc-coauthoring","dsh-docx","dsh-executing-plans",
  "dsh-frontend-design","dsh-git-worktrees","dsh-internal-comms","dsh-pdf","dsh-pptx",
  "dsh-skill-writing","dsh-slack-gif-creator","dsh-subagent-driven","dsh-subagent-orchestration",
  "dsh-superpowers-guide","dsh-systematic-debugging","dsh-tdd","dsh-web-artifacts-builder",
  "dsh-webapp-testing","dsh-writing-plans","dsh-xlsx",
  // 带 LICENSE 但正文标记未命中（人工复核补漏）
  "dsh-theme-factory",
  // 官方系无 LICENSE 文件 2
  "impeccable","design-taste-frontend",
]);

const JUNK = /\.bak[\w.-]*$|^\.gitkeep$/;
let nestedThirdParty = 0;

function copyClean(srcDir, destDir) {
  for (const ent of readdirSync(srcDir, { withFileTypes: true })) {
    if (JUNK.test(ent.name)) continue; // 过滤 .bak* / .gitkeep
    const s = join(srcDir, ent.name), d = join(destDir, ent.name);
    if (ent.isDirectory()) {
      // 泛化防第三方内嵌：技能内嵌套的独立项目（自带 LICENSE*）剔除——
      // src-hunter 实锤（MIT © MyuriKanao 2026，嵌于 dsh-sec-pentest-tools）
      const hasOwnLicense = readdirSync(s).some((n) => /^LICENSE(\..+)?$/.test(n));
      if (hasOwnLicense) { nestedThirdParty++; console.log(`剔除嵌套第三方: ${s.replace(src, "")}`); continue; }
      mkdirSync(d, { recursive: true });
      copyClean(s, d);
    } else if (ent.isFile()) {
      mkdirSync(dirname(d), { recursive: true });
      cpSync(s, d);
    }
  }
}

const src = process.argv[2] || join(process.env.USERPROFILE, ".dsh", "skills");
const dest = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

const dirs = readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(src, d.name, "SKILL.md")));
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

let copied = 0, excluded = 0;
for (const d of dirs) {
  if (EXCLUDED.has(d.name)) { excluded++; continue; }
  copyClean(join(src, d.name), join(dest, d.name));
  copied++;
}
console.log(`复制 ${copied} 个（排除 ${excluded} 个；源 ${dirs.length} 个含 SKILL.md 的目录）`);
console.log(`剔除嵌套第三方 ${nestedThirdParty} 处`);
console.log(`matched/total 自曝: ${copied + excluded}/${dirs.length}（差集=${dirs.length - copied - excluded}，非 0 即脚本缺陷）`);
