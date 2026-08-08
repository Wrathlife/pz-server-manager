# Accounts

Manages the Project Zomboid dedicated server **whitelist** SQLite database:

`%USERPROFILE%\Zomboid\db\{profile}.db` (default profile `servertest`).

## What the UI shows

Per whitelist row: username, role, Steam ID, last connection, display name, whether a password hash is set. Passwords themselves are never shown in the UI.

## Operations

| Action | Behavior |
|--------|----------|
| Reset password | If the server is running, prefers console `setpassword`; otherwise updates the DB (with a timestamped `.bak-*` copy first when writing the file). |
| Clear password | Same path as reset with an empty password where supported. |
| Wipe one user | Removes from whitelist (console when live, else DB) and related player data as implemented in `electron/accounts.ts`. |
| Wipe all | Optional keep-admin; confirms via native dialog before destructive work. |

Always back up `%USERPROFILE%\Zomboid` (or use the app’s zip backup) before mass wipe.

## Safety notes

- Writing the DB while the server is running can corrupt state; prefer console commands when the process is live, or stop the server first for offline DB edits.
- Wipe dialogs are intentional; there is no undo beyond your backups / `.bak-*` copies.
- This is a local admin tool for your own host — treat the machine and AppData as trusted.
