import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json')], {
    cwd: root,
    stdio: 'inherit',
  });
}
