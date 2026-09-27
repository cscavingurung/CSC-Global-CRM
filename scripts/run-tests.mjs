// Dependency-free test runner. Loads each tests/*.test.ts through the project's own Vite (so
// TypeScript and the `/src/...` imports work exactly as in the app) and runs the tests they
// register with tests/harness.ts. Usage: npm test
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const files = readdirSync(resolve(root, 'tests')).filter((f) => f.endsWith('.test.ts')).sort();
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let passed = 0;
let failed = 0;
try {
  const harness = await server.ssrLoadModule('/tests/harness.ts');
  for (const file of files) {
    harness.reset();
    await server.ssrLoadModule(`/tests/${file}`);
    console.log(`\n${file}`);
    for (const t of harness.registered()) {
      try {
        await t.fn();
        passed += 1;
        console.log(`  ✓ ${t.name}`);
      } catch (e) {
        failed += 1;
        console.log(`  ✗ ${t.name}\n      ${String(e?.message ?? e).split('\n').join('\n      ')}`);
      }
    }
  }
} finally {
  await server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
