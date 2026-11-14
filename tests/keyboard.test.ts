import { describe, expect, it } from "vitest";
import { layoutKeys } from "../src/keyboard/layout";
import { learn, makeTap, keyParams, type TouchModel } from "../src/keyboard/touchModel";
import { scoreWord, suggest } from "../src/keyboard/decoder";
import { isAccidentalRepeat } from "../src/keyboard/repeatFilter";
import { buildLexicon } from "../src/lexicon";

const keys = layoutKeys(400, 560, 8); // phone portrait: 4 columns
const key = (id: string) => keys.find((k) => k.id === id)!;
const at = (id: string, dx = 0, dy = 0) => {
  const k = key(id);
  return { x: k.x + k.w / 2 + dx * k.w, y: k.y + k.h / 2 + dy * k.h };
};
const tapAt = (id: string, dx = 0, dy = 0, model: TouchModel = {}) => {
  const p = at(id, dx, dy);
  return makeTap(p.x, p.y, keys, model);
};
const { entries } = buildLexicon("Xinwei, Dom, Daniel");

describe("layout", () => {
  it("puts A–Z in order with space and delete last", () => {
    expect(keys.map((k) => k.id).slice(0, 5)).toEqual(["a", "b", "c", "d", "e"]);
    expect(keys.slice(-2).map((k) => k.id)).toEqual(["space", "delete"]);
  });
});

describe("decoder", () => {
  it("finds the intended word from clean taps", () => {
    const taps = ["w", "a", "t"].map((l) => tapAt(l));
    expect(suggest(taps, entries, {}, 3).map((s) => s.word)).toContain("water");
  });

  it("recovers a word when one tap lands on a neighbouring key", () => {
    // "pain" with the "a" tap landing most of the way onto "b"
    const taps = [tapAt("p"), tapAt("a", 0.7, 0), tapAt("i"), tapAt("n")];
    expect(taps[1].shown).toBe("b");
    expect(suggest(taps, entries, {}, 3).map((s) => s.word)).toContain("pain");
  });

  it("lets one tap stand for a doubled letter", () => {
    const taps = ["h", "e", "l", "o"].map((l) => tapAt(l));
    const r = scoreWord(taps, "hello");
    expect(r).not.toBeNull();
    expect(r!.align).toEqual([0, 1, 2, 4]);
  });

  it("absorbs a stray repeat tap", () => {
    const taps = ["t", "t", "e", "a"].map((l) => tapAt(l));
    expect(suggest(taps, entries, {}, 3).map((s) => s.word)).toContain("tea");
  });

  it("suggests family names", () => {
    const taps = ["x", "i"].map((l) => tapAt(l));
    expect(suggest(taps, entries, {}, 3)[0].word).toBe("xinwei");
  });

  it("ranks her own frequent words higher", () => {
    const taps = ["b", "l"].map((l) => tapAt(l));
    const before = suggest(taps, entries, {}, 10).map((s) => s.word);
    const after = suggest(taps, entries, { blanket: 20 }, 10).map((s) => s.word);
    expect(after.indexOf("blanket")).toBeLessThan(before.indexOf("blanket") === -1 ? 99 : before.indexOf("blanket"));
    expect(after[0]).toBe("blanket");
  });
});

describe("touch model", () => {
  it("learns a consistent offset and then reads her taps correctly", () => {
    // She always lands half a key to the right of where she means.
    let model: TouchModel = {};
    const raw = tapAt("f", 0.55, 0);
    expect(raw.shown).toBe("g"); // before learning, read as the neighbour
    for (let i = 0; i < 15; i++) model = learn(model, "f", tapAt("f", 0.55, 0).off.f);
    expect(keyParams(model, "f").mx).toBeGreaterThan(0.4);
    expect(tapAt("f", 0.55, 0, model).shown).toBe("f");
  });
});

describe("repeat filter", () => {
  const press = (t: number, x = 100, y = 100) => ({ t, x, y, keyW: 90 });
  it("drops a quick nearby second press", () => {
    expect(isAccidentalRepeat(press(0), press(200, 120, 105), 400)).toBe(true);
  });
  it("keeps a slow second press", () => {
    expect(isAccidentalRepeat(press(0), press(600), 400)).toBe(false);
  });
  it("keeps a quick press on a different part of the board", () => {
    expect(isAccidentalRepeat(press(0), press(150, 300, 100), 400)).toBe(false);
  });
});
