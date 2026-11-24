// Tests run against the synthetic fixtures, bundled fresh before every run.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  execFileSync('pnpm', ['bundle:synthetic'], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
    stdio: 'ignore',
  });
}
