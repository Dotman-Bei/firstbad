import { afterEach, describe, expect, it } from 'vitest';
import { runSetup, startServer, urlResponds, waitDown, waitReady, type ServerHandle } from '../src/app/serve.js';
import { TINY_SERVER, tempDir } from './helpers.js';

const started: ServerHandle[] = [];
afterEach(async () => {
  for (const s of started.splice(0)) await s.stop();
});

describe('serve', () => {
  it('starts a server, sees it ready, stops it and sees it go quiet', async () => {
    const dir = tempDir('firstbad-serve-');
    expect(await urlResponds('http://127.0.0.1:4319/')).toBe(false);
    const s = startServer(`node "${TINY_SERVER}" 4311`, dir);
    started.push(s);
    expect(await waitReady('http://127.0.0.1:4311/', s, 10_000)).toEqual({ ok: true, detail: 'ready' });
    expect(await urlResponds('http://127.0.0.1:4311/')).toBe(true);
    await s.stop();
    expect(await waitDown('http://127.0.0.1:4311/', 5000)).toBe(true);
  });

  it('reports a crashing server and a server that never answers', async () => {
    const dir = tempDir('firstbad-serve-');
    const crash = startServer(`node "${TINY_SERVER}" 4312 --crash`, dir);
    started.push(crash);
    expect(await waitReady('http://127.0.0.1:4312/', crash, 10_000)).toEqual({ ok: false, detail: 'server exited with code 1' });
    const silent = startServer('node -e "setTimeout(() => {}, 60000)"', dir);
    started.push(silent);
    expect(await waitReady('http://127.0.0.1:4313/', silent, 1500)).toEqual({
      ok: false,
      detail: 'no answer from http://127.0.0.1:4313/ within 2 s',
    });
    await silent.stop();
    expect(silent.exited()).not.toBeUndefined();
  });

  it('runs setup commands with exit codes and a timeout', async () => {
    const dir = tempDir('firstbad-setup-');
    expect(await runSetup('node -e "process.exit(0)"', dir, 20_000)).toEqual({ ok: true, detail: 'ok' });
    expect(await runSetup('node -e "process.exit(3)"', dir, 20_000)).toEqual({ ok: false, detail: 'exit 3' });
    expect(await runSetup('node -e "setTimeout(() => {}, 60000)"', dir, 1000)).toEqual({ ok: false, detail: 'timed out after 1 s' });
  });
});
