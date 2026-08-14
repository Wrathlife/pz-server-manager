import { describe, expect, it } from "vitest";
import {
  parseModInfo,
  parseModIdsFromDescription,
  parseClientModlists,
  splitModIdList,
  workshopIdPrefix
} from "../shared/modIdParse";

describe("parseModInfo", () => {
  it("reads id= from mod.info", () => {
    const text = `name=Tsar's Common Library
id=tsarslib
description=Shared code
poster=poster.png
`;
    expect(parseModInfo(text)).toEqual(["tsarslib"]);
  });

  it("allows spaces around equals and strips quotes", () => {
    expect(parseModInfo("id = \"HotBrass\"\n")).toEqual(["HotBrass"]);
  });

  it("collects multiple id lines in order", () => {
    expect(parseModInfo("id=foo\nname=X\nid=bar\n")).toEqual(["foo", "bar"]);
  });

  it("ignores comments and other keys", () => {
    expect(parseModInfo("# id=nope\nname=Thing\nrequire=other\n")).toEqual([]);
  });
});

describe("parseModIdsFromDescription", () => {
  it("parses Mod ID: lines", () => {
    const text = `Workshop ID: 3402491515
Mod ID: tsarslib
`;
    expect(parseModIdsFromDescription(text)).toEqual(["tsarslib"]);
  });

  it("parses multiple Mod IDs and skips numeric Workshop IDs", () => {
    const text = "Mod IDs: damnlib, rSemiTruck, 3409472393";
    expect(parseModIdsFromDescription(text)).toEqual(["damnlib", "rSemiTruck"]);
  });

  it("strips BBCode around Mod ID", () => {
    expect(parseModIdsFromDescription("[b]Mod ID:[/b] ChuckleberryFinnAlertSystem")).toEqual([
      "ChuckleberryFinnAlertSystem"
    ]);
  });

  it("keeps ids that start with digits but are not purely numeric", () => {
    expect(parseModIdsFromDescription("Mod ID: 82porsche911")).toEqual(["82porsche911"]);
  });

  it("returns empty when no Mod ID line is present", () => {
    expect(parseModIdsFromDescription("A cool vehicle pack for B42.")).toEqual([]);
  });
});

describe("splitModIdList", () => {
  it("splits mixed separators and de-dupes", () => {
    expect(splitModIdList("tsarslib; damnlib, tsarslib\nfoo")).toEqual([
      "tsarslib",
      "damnlib",
      "foo"
    ]);
  });
});

describe("parseClientModlists", () => {
  it("reads named presets and skips favorites marker", () => {
    const text = `!fav!:
New:SWMG;MarzGuns;
MP:tsarslib;1299328280/ToadTraits;SwapIt;
`;
    expect(parseClientModlists(text)).toEqual([
      { name: "New", mods: ["SWMG", "MarzGuns"] },
      { name: "MP", mods: ["tsarslib", "1299328280/ToadTraits", "SwapIt"] }
    ]);
  });
});

describe("workshopIdPrefix", () => {
  it("pulls a numeric workshop id off a slashed Mod ID", () => {
    expect(workshopIdPrefix("1299328280/ToadTraitsDynamic")).toBe("1299328280");
    expect(workshopIdPrefix("tsarslib")).toBeNull();
  });
});
