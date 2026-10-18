import assert from "node:assert/strict";
import test from "node:test";
import { decodeUtf7XmlBytes, isUtf7XmlEncoding } from "./xml-utf7.js";

for (const [encoded, decoded] of [
  ["ASCII\t\r\n", "ASCII\t\r\n"], ["+-", "+"], ["+AOQ-", "ä"],
  ["+ZeVnLIqe-", "日本語"], ["+AGE-", "a"], ["+AQA-", "Ā"],
  ["+AOQ ", "ä "], ["+AOQ=", "ä="], ["+AOQ", "ä"],
  ["+2D3eAA-", "😀"], ["+//0-", "�"], ["+AFwAfg-", "\\~"],
  ["!?@[]^_`{|}", "!?@[]^_`{|}"]
]) test(`UTF-7 XML preserves ${JSON.stringify(encoded)}`, () => {
  assert.equal(decodeUtf7XmlBytes(Buffer.from(encoded!, "ascii")), decoded);
});

for (const encoded of [
  "+", "+!", "+A-", "+AA-", "+AGEA-", "+AGEAA-", "+AOQ/-",
  "+2AA-", "+3AA-", "+2AA-+3AA-", "+2AAAQQ-", "+////-", "\\", "~"
]) test(`UTF-7 XML rejects incomplete, corrupt or non-direct ${JSON.stringify(encoded)}`, () => {
  assert.equal(decodeUtf7XmlBytes(Buffer.from(encoded, "ascii")), null);
});

for (const byte of [0, 1, 0x7f, 0x80, 0xff]) test(`UTF-7 XML rejects raw byte ${byte}`, () => {
  assert.equal(decodeUtf7XmlBytes(Buffer.from([byte])), null);
});

test("UTF-7 XML allowlist excludes transport and unrelated Unicode codecs", () => {
  for (const name of ["utf-7", "utf7", "unicode-1-1-utf-7"]) assert.equal(isUtf7XmlEncoding(name), true);
  for (const name of ["base64", "hex", "cesu8", "utf7imap", "csunicode11utf7"]) assert.equal(isUtf7XmlEncoding(name), false);
});
