import fs from 'node:fs';
import path from 'node:path';

export const DEMO_PORT = 4173;

export interface DemoCheck {
  url: string;
  do: string;
  store: string;
  expected: string;
}

export function demoCheck(port: number): DemoCheck {
  return {
    url: `http://127.0.0.1:${port}/`,
    do: 'add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply',
    store: 'the total amount shown next to the word Total',
    expected: '$18.00',
  };
}

export function demoServeCommand(port: number): string {
  return `node server.js ${port}`;
}

export class DemoDirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoDirError';
  }
}

export interface DemoDirs {
  root: string;
  shopDir: string;
  reportDir: string;
}

export function prepareDemoDir(dir: string, force: boolean): DemoDirs {
  const root = path.resolve(dir);
  if (fs.existsSync(root)) {
    const entries = fs.readdirSync(root);
    if (entries.length > 0) {
      if (!force) throw new DemoDirError(`${root} is not empty (use --force to replace an earlier demo)`);
      if (!entries.every((e) => e === 'shop' || e === 'report')) {
        throw new DemoDirError(`refusing to delete ${root}: it does not look like an earlier firstbad demo (only shop/ and report/ are expected)`);
      }
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  }
  fs.mkdirSync(root, { recursive: true });
  return { root, shopDir: path.join(root, 'shop'), reportDir: path.join(root, 'report') };
}
