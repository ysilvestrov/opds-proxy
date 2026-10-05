/** DEPLOY-002: real process/files/HTTP, injected CI approval; never production units. */
import { mkdtemp, readFile, writeFile, mkdir, cp, symlink, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { deployCandidate } from './autodeploy.mjs';
import { observeReadiness } from './observe.mjs';

export async function verifyDeploymentIsolation(artifactDirectory) {
  if (process.platform !== 'linux' || process.versions.node.split('.')[0] !== '24')
    throw Error('Linux Node 24 required');
  const artifact = resolve(artifactDirectory);
  const manifest = JSON.parse(await readFile(join(artifact, 'release.json'), 'utf8'));
  if (!/^[0-9a-f]{40}$/.test(manifest.sha)) throw Error('Invalid artifact identity');
  const healthy = manifest.sha;
  const broken = (healthy === 'a'.repeat(40) ? 'b' : 'a').repeat(40);
  const root = await mkdtemp(join(tmpdir(), 'opds-deploy-check-'));
  const releases = join(root, 'releases'), current = join(root, 'current');
  const stateFile = join(root, 'state.json'), cache = join(root, 'cache');
  let child, exited, starts = 0;
  const stop = async () => {
    if (!child) return;
    const running = child;
    running.kill('SIGTERM');
    const force = setTimeout(() => running.kill('SIGKILL'), 2000);
    try { await exited; } finally { clearTimeout(force); child = undefined; }
  };
  try {
    await mkdir(releases); await mkdir(cache);
    const port = await new Promise((yes, no) => {
      const server = createServer(); server.once('error', no);
      server.listen(0, '127.0.0.1', () => {
        const p = server.address().port; server.close(error => error ? no(error) : yes(p));
      });
    });
    let candidate = healthy;
    const saveState = async state => {
      await writeFile(stateFile + '.next', JSON.stringify(state), { mode: 0o600 });
      await rename(stateFile + '.next', stateFile);
    };
    await saveState({ phase: 'idle', settledSHA: null, previousSHA: null, failedSHA: null });
    const probe = async sha => {
      if (!child || child.exitCode !== null || child.signalCode !== null) return false;
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
      const health = await response.json();
      if (!response.ok || !health.ready || health.sha !== sha) return false;
      const feed = await fetch(`http://127.0.0.1:${port}/opds/searchfloor`, {
        headers: { authorization: 'Basic ' + Buffer.from('fixture:fixture').toString('base64') },
        signal: AbortSignal.timeout(1000),
      });
      return feed.ok && (await feed.text()).includes('<feed');
    };
    const effects = {
      lock: async () => true, unlock: async () => {}, paused: async () => false,
      readState: async () => JSON.parse(await readFile(stateFile, 'utf8')), saveState,
      main: async () => candidate, approved: async () => true,
      prune: async () => {}, // Only two owned fixtures; both removed in finally.
      stage: async sha => {
        const dest = join(releases, sha); await mkdir(dest);
        await cp(join(artifact, 'dist'), join(dest, 'dist'), { recursive: true });
        await cp(join(artifact, 'package.json'), join(dest, 'package.json'));
        await symlink(join(artifact, 'node_modules'), join(dest, 'node_modules'), 'dir');
        await writeFile(join(dest, 'release.json'), JSON.stringify({ ...manifest, sha }));
        if (sha === broken) await writeFile(join(dest, 'dist/index.js'), 'process.exit(23);');
      },
      switchCurrent: async sha => {
        if (sha === null) { await rm(current, { force: true }); return; }
        await symlink(join(releases, sha), current + '.next', 'dir');
        await rename(current + '.next', current);
      },
      restart: async () => {
        await stop(); starts++;
        child = spawn(process.execPath, [join(current, 'dist/index.js')], {
          cwd: current, stdio: 'ignore', env: {
            PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port),
            PUBLIC_BASE_URL: 'https://opds.invalid', CACHE_PATH: join(cache, 'catalog.sqlite'),
            OPDS_USERNAME: 'fixture', OPDS_PASSWORD: 'fixture',
          },
        });
        exited = new Promise(yes => { child.once('exit', yes); child.once('error', yes); });
      }, stop,
      resetCache: async () => { await rm(cache, { recursive: true }); await mkdir(cache); },
      observe: sha => observeReadiness({ probe: () => probe(sha),
        restarts: async () => starts + (child && (child.exitCode !== null || child.signalCode !== null) ? 1 : 0),
        startupMs: 10000, stableMs: 100, intervalMs: 20 }),
    };
    const successfulRelease = await deployCandidate(effects);
    if (successfulRelease !== 'deployed') throw Error('Initial fixture failed');
    candidate = broken;
    const failedRelease = await deployCandidate(effects);
    const state = await effects.readState();
    const rollbackHealth = state.settledSHA === healthy && state.failedSHA === broken && await probe(healthy);
    const failedRetry = await deployCandidate(effects);
    candidate = healthy;
    const noop = await deployCandidate(effects);
    const result = { successfulRelease, failedRelease, failedRetry, rollbackHealth, noop };
    if (successfulRelease !== 'deployed' || failedRelease !== 'rolled-back' ||
        failedRetry !== 'held' || !rollbackHealth || noop !== 'noop') throw Error('Isolation verification failed');
    return result;
  } finally {
    await stop();
    // root is a fresh mkdtemp result; no caller-supplied directory is removed.
    await rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--artifact-dir') throw Error('Invalid arguments');
    console.log(JSON.stringify(await verifyDeploymentIsolation(process.argv[3])));
  } catch {
    console.error('Deployment isolation verification failed; production was not modified.');
    process.exitCode = 1;
  }
}
