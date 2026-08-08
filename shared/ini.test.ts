import { describe, expect, it } from "vitest";
import {
  applyIniUpdates,
  joinIniList,
  parseIni,
  serializeIni,
  splitIniList
} from "../shared/ini";

describe("ini round-trip", () => {
  it("preserves comments and updates values", () => {
    const src = `# comment
Open=true

# ports
DefaultPort=16261
Password=
`;
    const doc = parseIni(src);
    expect(doc.values.Open).toBe("true");
    const next = applyIniUpdates(doc, { Open: "false", Password: "secret", PublicName: "Test" });
    const out = serializeIni(next);
    expect(out).toContain("# comment");
    expect(out).toContain("# ports");
    expect(out).toContain("Open=false");
    expect(out).toContain("Password=secret");
    expect(out).toContain("PublicName=Test");
    expect(out).toContain("DefaultPort=16261");
  });

  it("splits and joins mod lists preserving order", () => {
    expect(splitIniList("A; B;C ;")).toEqual(["A", "B", "C"]);
    expect(joinIniList(["A", " B ", "", "C"])).toBe("A;B;C");
  });
});
