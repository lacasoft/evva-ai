import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Cargar .env desde la raíz del proyecto
function loadEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
  for (const name of [".env.local", ".env"]) {
    const envPath = join(root, name);
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL no está configurada");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Asegurar tabla de tracking de migraciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Obtener migraciones ya aplicadas
    const { rows: applied } = await client.query(
      "SELECT name FROM _migrations ORDER BY name",
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Leer archivos SQL en orden
    const files = readdirSync(__dirname)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (ya aplicada)`);
        continue;
      }

      console.log(`  → Aplicando ${file}...`);
      const sql = readFileSync(join(__dirname, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`  ✓ ${file} aplicada`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ Error en ${file}:`, err);
        process.exit(1);
      }
    }

    console.log("\nMigraciones completadas.");
  } finally {
    await client.end();
  }
}

runMigrations();
