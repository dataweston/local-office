import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS from 'openapi-typescript';
import { parseDocument } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const specPath = path.join(packageRoot, 'openapi.yaml');
const distDir = path.join(packageRoot, 'dist');
const schemaDir = path.join(distDir, 'schemas');

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function writeJson(target, value) {
  const filePath = typeof target === 'string' ? target : String(target);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(filePath, Buffer.from(payload, 'utf8'));
}

async function main() {
  const raw = await fs.readFile(specPath, 'utf8');
  const document = parseDocument(raw);
  const spec = JSON.parse(JSON.stringify(document.toJS({ json: true })));

  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(schemaDir);

  await writeJson(path.join(distDir, 'openapi.json'), spec);

  const types = await openapiTS(spec, { immutable: true, alphabetize: true });
  const typesContent = typeof types === 'string' ? types : String(types);
  await fs.writeFile(path.join(distDir, 'types.d.ts'), typesContent, 'utf8');

  const schemas = spec?.components?.schemas ?? {};
  for (const [schemaName, schema] of Object.entries(schemas)) {
    const name = String(schemaName);
    const document = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `#/components/schemas/${name}`,
      ...schema
    };

    await writeJson(path.join(schemaDir, `${name}.json`), document);
  }
}

main().catch((error) => {
  console.error('Failed to generate contracts', error);
  process.exitCode = 1;
});
