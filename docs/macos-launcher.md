# Model Studio macOS launcher

> FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION

Model Studio installs as a normal user-level macOS application. Double-clicking
the app checks the real local service, starts the committed pm2 application only
when needed, waits for `/api/health`, and opens the console in the default
browser. It never launches an unsupervised server.

## Install or refresh

From the repository, run once:

```bash
scripts/install-model-studio-app.sh
```

This reproducibly creates:

- `~/Applications/Model Studio.app` — the generated application bundle;
- `~/Desktop/Model Studio.app` — a symlink with the normal application icon;
- `~/Library/Application Support/Model Studio/repository` — a stable link to
  this repository.

The generated app is intentionally ignored by git. Its AppleScript source,
installer, launcher, service script, and pm2 ecosystem are committed.

## Normal operation

Double-click **Model Studio** in Applications or on the Desktop. The launcher:

1. requests `http://127.0.0.1:8765/api/health` and verifies both the service
   name and healthy status;
2. opens the console immediately when the existing service is healthy;
3. otherwise starts or reuses the single pm2 app named
   `civil-model-studio` from `ops/model-studio-ecosystem.config.cjs`;
4. waits up to 30 seconds for a real health response; and
5. opens `http://127.0.0.1:8765/` in the default browser.

If pm2 is unavailable, the supervisor cannot start, or the endpoint never
becomes healthy, macOS displays a critical error instead of opening a broken
page. The launcher does not create a second service with a different name.

## Operator checks and recovery

```bash
pm2 show civil-model-studio
curl -fsS http://127.0.0.1:8765/api/health
pm2 logs civil-model-studio --lines 50 --nostream
```

Re-run the installer after moving the repository. Do not manually run
`model-studio serve` in the background; use the app or the committed ecosystem
so crashes and restarts remain visible in pm2.
