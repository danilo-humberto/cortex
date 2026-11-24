import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSql, ensureSchema, seedRoadmapTopics } from "../src/worker/db.ts";

function loadDevVarsIfPresent(): void {
  const candidates = [".dev.vars", ".env"];
  for (const file of candidates) {
    const fullPath = resolve(process.cwd(), file);
    if (!existsSync(fullPath)) continue;
    const raw = readFileSync(fullPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadDevVarsIfPresent();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "Erro: defina DATABASE_URL no ambiente ou no arquivo .dev.vars antes de rodar o seed."
    );
    process.exit(1);
  }

  const sql = createSql(databaseUrl);
  console.log("Criando schema no NeonDB (se ainda não existir)...");
  await ensureSchema(sql);
  console.log("Populando tópicos do data/roadmap.json...");
  const total = await seedRoadmapTopics(sql);
  console.log(`Sucesso! ${total} tópicos sincronizados no NeonDB.`);
}

main().catch((err) => {
  console.error("Falha ao rodar seed:", err);
  process.exit(1);
});
