import { describe, expect, it } from "vitest";
import { applySandboxUpdates, parseSandboxVars } from "../electron/sandbox";
import { alignSandboxModSections } from "../shared/sandboxAlign";

const SAMPLE = `SandboxVars = {
    VERSION = 6,
    Zombies = 3,
    PauseEmpty = true,
    MultiplierConfig = {
        Fitness = 1.0,
        Strength = 1.0,
    },
    HB = {
        -- Leave empty brass on the ground
        PermanentCasings = true,
        CustomIcons = true,
        CasingSounds = false,
    },
    rSemiTruck = {
        -- Min: 0,00 Max: 10,00 Default: 0,50
        MilSpawnMultiplier = 0.5,
        GuaranteedMilitarySpawns = true,
    },
}
`;

describe("sandbox nested parse", () => {
  it("groups mod tables and root fields", () => {
    const { sections, flat } = parseSandboxVars(SAMPLE);
    expect(flat.Zombies).toBe("3");
    expect(flat["HB.PermanentCasings"]).toBe("true");
    expect(flat["rSemiTruck.MilSpawnMultiplier"]).toBe("0.5");

    const hb = sections.find((s) => s.id === "HB");
    expect(hb?.isMod).toBe(true);
    expect(hb?.fields.some((f) => f.key === "PermanentCasings")).toBe(true);
    expect(hb?.fields.find((f) => f.key === "PermanentCasings")?.label).toMatch(/brass/i);

    const mult = sections.find((s) => s.id === "MultiplierConfig");
    expect(mult?.isMod).toBe(false);
  });

  it("updates nested values while preserving structure", () => {
    const next = applySandboxUpdates(SAMPLE, {
      "HB.PermanentCasings": "false",
      Zombies: "5"
    });
    expect(next).toMatch(/Zombies = 5,/);
    expect(next).toMatch(/PermanentCasings = false,/);
    expect(next).toContain("CustomIcons = true");
    expect(next).toContain("rSemiTruck = {");
  });
});

describe("alignSandboxModSections", () => {
  it("orders lua tables to match INI Mods= and reports leftovers", () => {
    const sections = [
      { id: "MarzGuns" },
      { id: "HB" },
      { id: "MSW" },
      { id: "OrphanTable" },
      { id: "GWG" }
    ];
    const { aligned, orphans, missing } = alignSandboxModSections(sections, [
      "SWMG",
      "HBVCEFb42",
      "MarzGuns",
      "CleanUI"
    ]);
    expect(aligned.map((s) => s.id)).toEqual(["HB", "GWG", "MarzGuns", "MSW"]);
    expect(orphans.map((s) => s.id)).toEqual(["OrphanTable"]);
    expect(missing).toEqual(["CleanUI"]);
  });
});
