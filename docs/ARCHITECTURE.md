# Architecture

Electron desktop app: **main process** (Node + TypeScript) owns files, process control, and SQLite; **renderer** (React + Vite) is the UI.

```
src/                 React pages (Dashboard, INI, Sandbox, Mods, Accounts, …)
electron/
  main.ts            IPC handlers + window dialogs
  preload.ts         contextBridge API for the renderer
  processManager.ts  start/stop/restart, console stdin, discover PIDs
  sandbox.ts         SandboxVars.lua parse/serialize (vanilla + mod tables)
  accounts.ts        whitelist DB read/write + wipe helpers
  settingsStore.ts   AppData settings + resolved paths
shared/              Pure parsers/tests (INI, sandbox) usable without Electron
```

## Paths

Resolved from app settings (`%APPDATA%\pz-server-manager\settings.json`):

| Logical | Typical resolved path |
|---------|------------------------|
| Install | Steam dedicated server folder |
| Start script | `{install}\StartServer64.bat` |
| Profile INI | `{zomboidDir}\Server\{profile}.ini` |
| SandboxVars | `{zomboidDir}\Server\{profile}_SandboxVars.lua` |
| Accounts DB | `{zomboidDir}\db\{profile}.db` |
| Console log | `{zomboidDir}\server-console.txt` (tail) |
| Backups | `{zomboidDir}\backups\pz-server-manager\` |

## Process control

- Start runs the configured `.bat` and tracks the process tree.
- Stop uses `taskkill /T /F` on that tree when needed.
- Console UI can send lines to the server stdin when attached; some account ops prefer in-game console commands when the server is running.
- Dashboard can reset the world save for the profile while keeping config.

## Config editors

- **INI**: comment-preserving parse/serialize (`shared/ini.ts`).
- **Sandbox**: Lua table sections for Vanilla + Mods, including nested tables; raw Lua fallback.
- **Mods**: Workshop / mod ID lists with optional Steam title resolve (cached under AppData).

## Related sandbox tools

For client game update / decompile / map reverse (not this app), see [pz-sandbox-refresh](https://github.com/Wrathlife/pz-sandbox-refresh).
