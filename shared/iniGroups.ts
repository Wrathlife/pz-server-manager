import type { IniGroup } from "./types";

/** Known keys grouped for the Settings UI. Unknown keys land in Misc. */
export const INI_GROUPS: IniGroup[] = [
  {
    id: "network",
    label: "Network",
    keys: [
      "PublicName",
      "PublicDescription",
      "Public",
      "DefaultPort",
      "UDPPort",
      "UPnP",
      "MaxPlayers",
      "PingLimit",
      "SteamPort1",
      "SteamPort2",
      "SteamScoreboard",
      "DenyLoginOnOverloadedServer"
    ]
  },
  {
    id: "access",
    label: "Access",
    keys: [
      "Open",
      "Password",
      "DropOffWhiteListAfterDeath",
      "LoginQueueEnabled",
      "LoginQueueConnectTimeout",
      "AllowNonAsciiUsername",
      "DoLuaChecksum",
      "Mods",
      "WorkshopItems",
      "Map"
    ]
  },
  {
    id: "gameplay",
    label: "Gameplay",
    keys: [
      "PVP",
      "PVPLogToolChat",
      "PVPLogToolFile",
      "PauseEmpty",
      "SafetySystem",
      "ShowSafety",
      "SafetyToggleTimer",
      "SafetyCooldownTimer",
      "SafetyDisconnectDelay",
      "NoFire",
      "SpawnPoint",
      "SpawnItems",
      "ResetID",
      "HoursForLootRespawn",
      "MaxItemsForLootRespawn",
      "ConstructionPreventsLootRespawn"
    ]
  },
  {
    id: "chat",
    label: "Chat",
    keys: [
      "GlobalChat",
      "ChatStreams",
      "ServerWelcomeMessage",
      "DisplayUserName",
      "ShowFirstAndLastName",
      "UsernameDisguises",
      "HideDisguisedUserName"
    ]
  },
  {
    id: "safehouse",
    label: "Safehouse",
    keys: [
      "SafehousePreventsLootRespawn",
      "AdminSafehouse",
      "PlayerSafehouse",
      "SafehouseAllowTrepass",
      "SafehouseAllowFire",
      "SafehouseAllowLoot",
      "SafehouseAllowRespawn",
      "SafehouseDaySurvivedToClaim",
      "DisableSafehouseWhenOwnerConnected"
    ]
  },
  {
    id: "rcon",
    label: "RCON",
    keys: ["RCONPort", "RCONPassword"]
  },
  {
    id: "misc",
    label: "Misc",
    keys: [
      "HideAdminsInPlayerList",
      "DisableRadioAdmin",
      "ItemNumbersLimitPerContainer",
      "BloodSplatLifespanDays",
      "AllowCoop",
      "SleepAllowed",
      "SleepNeeded"
    ]
  }
];

export const QUICK_DASHBOARD_KEYS = [
  "PublicName",
  "Public",
  "Open",
  "Password",
  "MaxPlayers",
  "DefaultPort",
  "UDPPort",
  "UPnP"
] as const;
