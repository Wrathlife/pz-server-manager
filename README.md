# PZ Server Manager

Desktop GUI for configuring and running a **Project Zomboid Dedicated Server** on Windows — without hand-editing INI files all day.

## Features

- Editable paths (install dir, start script, Zomboid user data, server profile name, backups)
- Steam path detection
- Start / Stop / Restart
- Live console tail (`server-console.txt`)
- Dashboard quick settings + join info (loopback / LAN / public IP)
- Full `servertest.ini` editor (grouped + search, preserves comments)
- SandboxVars editor (structured + raw)
- Mods / WorkshopItems chip editor
- Config (+ optional world/logs) zip backup & restore

## Defaults

| Setting | Default |
|---------|---------|
| Install | `C:\Program Files (x86)\Steam\steamapps\common\Project Zomboid Dedicated Server` |
| Start script | `{install}\StartServer64.bat` |
| Zomboid data | `%USERPROFILE%\Zomboid` |
| Profile | `servertest` → `%USERPROFILE%\Zomboid\Server\servertest.ini` |
| Backups | `%USERPROFILE%\Zomboid\backups\pz-server-manager\` |
| App settings | `%APPDATA%\pz-server-manager\settings.json` |

## Develop

```bash
npm install
npm run dev
```

This builds the Electron main process, starts Vite on `http://127.0.0.1:5173`, then opens Electron.

## Build / run production renderer

```bash
npm run build
npm run preview
```

(`preview` launches Electron against the built `dist/` UI.)

## Tests

```bash
npm test
```

## Notes

- Stop may force-kill the process tree started by this app (`taskkill /T /F`).
- Internet joins still need UDP **16261** and **16262** reachable (UPnP or port forward).
- Workshop content is not auto-downloaded; IDs are only written into the server INI.
