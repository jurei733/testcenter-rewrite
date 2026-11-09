import assert from "node:assert/strict";
import test from "node:test";
import {decodeSourceBase64} from "./source-base64.js";

const previous = (input: string): Buffer | null => {
  const value = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 !== 1
    ? Buffer.from(value, "base64") : null;
};
const equivalent = (input: string): void => assert.deepEqual(decodeSourceBase64(input), previous(input));

test("persisted Base64 retains standard bytes, URL alphabet, whitespace and legacy padding", () => {
  assert.deepEqual(decodeSourceBase64(" T W\tF\nu\r\ufeff"), Buffer.from("Man"));
  assert.deepEqual(decodeSourceBase64("-_8="), Buffer.from([251, 255]));
  for (const value of ["", "A=", "A==", "==", "AB==", "Zm9v=="]) equivalent(value);
  for (const value of ["A", "=", "A===", "A=A=", "AAA#", "AAA\u0141", "AAA\ud800"]) {
    assert.equal(decodeSourceBase64(value), null, JSON.stringify(value));
  }
});

test("persisted Base64 acceptance matches the previous guard for every UTF16 code unit", () => {
  for (let code = 0; code <= 0xffff; code++) equivalent("AA" + String.fromCharCode(code) + "A");
});

test("persisted Base64 retains padding and invalid-character behavior across short sequences", () => {
  const alphabet = ["A", "B", "/", "=", "-", "#", "\0", "\n"];
  const visit = (value: string, depth: number): void => {
    equivalent(value);
    if (depth) for (const next of alphabet) visit(value + next, depth - 1);
  };
  visit("", 5);
  let state = 2391;
  const extras = [...alphabet, "Z", "9", "+", "_", "\ud83d\ude00", "\u0141", "\u0085", "\u2003"];
  for (let i = 0; i < 20_000; i++) {
    let value = "";
    for (let n = 0; n < i % 31; n++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      value += extras[state % extras.length];
    }
    equivalent(value);
  }
});

test("large persisted Base64 stays byte-exact and rejects invalid characters at every boundary", () => {
  for (const extra of [0, 1, 2]) {
    const bytes = Buffer.alloc(1024 * 1024 + extra);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i * 73;
    const encoded = bytes.toString("base64");
    assert.deepEqual(decodeSourceBase64(encoded), bytes);
    for (const position of [0, 4095, 4096, Math.floor(encoded.length / 2), encoded.length - 4]) {
      for (const invalid of ["#", "\0", "\u0141"]) {
        assert.equal(decodeSourceBase64(encoded.slice(0, position) + invalid + encoded.slice(position + 1)), null);
      }
    }
  }
});
