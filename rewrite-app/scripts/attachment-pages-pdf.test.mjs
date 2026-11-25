import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import QRCode from "qrcode";
import { PDFArray, PDFDocument, PDFName, PDFNull, PDFRawStream, decodePDFRawStream } from "pdf-lib";

// Inspect the PDF actually produced by the production renderer, including its
// image transforms. Fixtures contain only owned synthetic attachment metadata.
const source = await readFile(new URL("../apps/api/src/attachment-pages-pdf.ts", import.meta.url), "utf8");
const executable = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replaceAll('"pdf-lib"', JSON.stringify(import.meta.resolve("pdf-lib")))
  .replaceAll('"qrcode"', JSON.stringify(import.meta.resolve("qrcode")));
const { createAttachmentPagesPdf } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`);
const attachment = { attachmentId:"owned-synthetic-printed-qr", groupKey:"own-group",
  loginKey:"own-login", personLabel:"Own Person", bookletKey:"own-booklet",
  unitKey:"own-unit", variableId:"own-image", attachmentType:"capture-image" };
const mm = 72 / 25.4;
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-8, `${actual} != ${expected}`);

for (const code of [undefined, null, "", "own-code", "$& $` $' $$"]) test(`Original CODE substitution is the participant suffix, never the QR identifier: ${JSON.stringify(code)}`, async () => {
  const input = { ...attachment, participantCode: code };
  const pdf = await PDFDocument.load(await createAttachmentPagesPdf({ attachments: [input],
    layout: "original", labelTemplate: "%GROUP%|%TESTTAKER%|%BOOKLET%|%UNIT%|%VAR%|%LOGIN%|%CODE%|%CODE%" }));
  assert.equal(pdf.getTitle(), `own-group|Own Person|own-booklet|own-unit|own-image|own-login|${code ?? ""}|${code ?? ""}`);
});
test("Original substitution inserts authored JavaScript replacement tokens literally, like PHP str_replace", async () => {
  const value = "$& $` $' $$";
  const pdf = await PDFDocument.load(await createAttachmentPagesPdf({ attachments: [{ ...attachment, personLabel: value }],
    layout: "original", labelTemplate: "Before %TESTTAKER% / %TESTTAKER% After" }));
  assert.equal(pdf.getTitle(), `Before ${value} / ${value} After`);
});
test("Original multi-page document title lists distinct authored group labels in source order", async () => {
  const pdf = await PDFDocument.load(await createAttachmentPagesPdf({ layout: "original", attachments: [
    { ...attachment, groupLabel: "Authored A" }, { ...attachment, groupKey: "other", groupLabel: "Authored B" },
    { ...attachment, groupLabel: "Authored A" }, { ...attachment, groupLabel: "" }, { ...attachment, groupKey: "legacy" }
  ] }));
  assert.equal(pdf.getTitle(), "Authored A, Authored B, , legacy");
});
async function rendered(input) {
  const pdf = await PDFDocument.load(await createAttachmentPagesPdf(input));
  const pages = pdf.getPages();
  return pages.map(page => {
    const streams = pdf.context.lookup(page.node.Contents(), PDFArray);
    const streamsText = Array.from({length:streams.size()},(_,i)=>Buffer.from(decodePDFRawStream(
      pdf.context.lookup(streams.get(i),PDFRawStream)).decode()).toString("ascii"));
    const content = streamsText.join("\n");
    const nativeQrStreams = streamsText.filter(stream=>stream.startsWith("q\n0 0 0 rg\n"));
    const modules = nativeQrStreams.flatMap(stream=>stream.trimEnd().split("\n").slice(2,-1).map(operator=>{
      assert.match(operator,/^[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ re f$/);
      return operator.split(" ").slice(0,4).map(Number);
    }));
    const images = content.split("q\n").filter(block=>/\/Image[^\s]* Do/.test(block));
    const image = images[0];
    // Source can overflow the authored label onto another page; only its final
    // label page contains that attachment's QR. Each case asserts the expected
    // presence and page count explicitly below.
    const transforms = image ? [...image.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(match=>match.slice(1).map(Number)) : [];
    let matrix = image ? [1,0,0,1,0,0] : null;
    for(const [a,b,c,d,e,f] of transforms) {
      const [aa,bb,cc,dd,ee,ff]=matrix;
      matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];
    }
    const fonts = page.node.Resources().lookup(PDFName.of("Font"));
    return {page,content,matrix,fonts,pdf,imageCount:images.length,nativeQrCount:nativeQrStreams.length,modules};
  });
}

test("Original labels print WinAnsi punctuation with one fallback per unsupported Unicode character", async () => {
  const labelTemplate = "Grüße € „A“ ’ – — œ Ł Ω 🙂";
  const [{content, pdf}] = await rendered({attachments:[attachment], layout:"original", labelTemplate});
  const text = content.match(/<([a-f\d]+)> Tj/i)?.[1];
  const x = Number(content.match(/1 0 0 1 ([-\d.]+) [-\d.]+ Tm/)?.[1]);
  assert.ok(text);
  assert.equal(new TextDecoder("windows-1252").decode(Buffer.from(text,"hex")), "Grüße € „A“ ’ – — œ ? ? ?");
  assert.equal(x, 227.396);
  assert.equal(pdf.getTitle(),labelTemplate);
});

test("Original wraps the authored Unicode before measuring the encoded line for centering", async () => {
  const labelTemplate = "Bögen – Łódź Ω/zulu-person-12094744 | CY-BKLT_TC-5-12094744 | CY-UNIT.SAMPLE-101 | sheet";
  const [{content}] = await rendered({attachments:[attachment], layout:"original", labelTemplate});
  const lines = [...content.matchAll(/<([a-f\d]+)> Tj/gi)];
  assert.equal(lines.length, 1);
  assert.equal(new TextDecoder("windows-1252").decode(Buffer.from(lines[0][1],"hex")),
    "Bögen – ?ód? ?/zulu-person-12094744 | CY-BKLT_TC-5-12094744 | CY-UNIT.SAMPLE-101 | sheet");
  near(Number(content.match(/1 0 0 1 ([-\d.]+) [-\d.]+ Tm/)?.[1]),31.172);
});

// Text bytes and positions from the pinned Original's authenticated /attachment/:id/page response.
const longLabel = "Teilnehmendengruppe Abschlussprüfung Lesen und Schreiben im Frühjahr bei Sonnenschein";
const longWord = "Wörterbuchübersetzungsmöglichkeiten".repeat(2);
for (const [name, labelTemplate, expected] of [
  ["unbroken soft hyphen", `${longLabel} Lesekompetenz\u00adprüfung`, [
    [48.518, 801.804, longLabel], [234.938, 786.804, "Lesekompetenzprüfung"]
  ]],
  ["soft hyphen at a wrap", `${longWord}\u00adMehrsprachigkeitsstudie`, [
    [88.232, 801.804, `${longWord}-`], [232.952, 786.804, "Mehrsprachigkeitsstudie"]
  ]],
  ["narrow no-break spaces", `${longLabel}\u202fNord\u202fWest`, [
    [32.180, 801.804, `${longLabel}?Nord`], [283.970, 786.804, "West"]
  ]],
  ["legacy no-break spaces", `${longLabel}\u00a0Nord\u00a0West`, [
    [88.208, 801.804, longLabel.replace(" Sonnenschein", "")], [229.610, 786.804, "Sonnenschein Nord West"]
  ]],
  ["tabs and a blank line", "Müller\tNord\tWest\n\nTeilnahme Ä Ö Ü", [
    [248.636, 801.804, "Müller\tNord\tWest"], [251.624, 771.804, "Teilnahme Ä Ö Ü"]
  ]]
]) test(`Original PDF preserves ${name}`, async () => {
  const [{ content }] = await rendered({ attachments: [attachment], layout: "original", labelTemplate });
  const lines = [...content.matchAll(/1 0 0 1 ([-\d.]+) ([-\d.]+) Tm\n<([a-f\d]+)> Tj/gi)];
  assert.equal(lines.length, expected.length);
  for (const [index, [, x, y, encoded]] of lines.entries()) {
    const [expectedX, expectedY, expectedText] = expected[index];
    near(Number(x), expectedX);
    near(Number(y), expectedY);
    assert.equal(Buffer.from(encoded, "hex").toString("latin1"), expectedText);
  }
});

test("Original printed QR occupies the Source 20/20/40/40 mm region on each attachment's final label page",async()=>{
  const attachments = [attachment,{...attachment,attachmentId:"second-owned-qr"}];
  const rows = await rendered({attachments,layout:"original",labelTemplate:"Own long label ".repeat(30)});
  assert.equal(rows.length,2);
  for(const [index,{page,nativeQrCount,imageCount,modules}] of rows.entries()) {
    assert.equal(nativeQrCount,1);
    assert.equal(imageCount,0,"Only the dark modules may paint over the label");
    near(page.getWidth(),595.276); near(page.getHeight(),841.89);
    const {modules: qr} = QRCode.create(attachments[index].attachmentId,{errorCorrectionLevel:"L"});
    const expected = [];
    const size = 40 * mm / qr.size;
    for(let row=0;row<qr.size;row++) for(let column=0;column<qr.size;column++) {
      if(qr.get(row,column)) expected.push([
        20 * mm + column * size, page.getHeight() - 20 * mm - row * size, size, -size
      ].map(value=>Number(value.toFixed(6))));
    }
    assert.deepEqual(modules,expected);
  }
});

const originalReference = JSON.parse(await readFile(
  new URL("./fixtures/original-attachment-pdf-labels.json",import.meta.url),"utf8"));
for(const reference of originalReference.cases) {
  test(`Original PDF matches actual unmodified TCPDF label text, positions and pages: ${reference.name}`,async()=>{
    const rows = await rendered({attachments:[{...attachment,attachmentId:"1:Own Unit:own-image",
      personLabel:"Own Group/own-login/own-code",bookletKey:"Own Booklet",unitKey:"Own Unit"}],
      layout:"original",labelTemplate:reference.labelTemplate});
    assert.equal(rows.length,reference.pages.length,"All Source pages must be retained");
    for(const [index,{page,content,fonts,pdf,imageCount,nativeQrCount,modules}] of rows.entries()) {
      const expected = reference.pages[index];
      near(page.getWidth(),expected.width); near(page.getHeight(),expected.height);
      assert.equal(nativeQrCount,Number(expected.qr),"The QR belongs on the same Source page");
      assert.equal(imageCount,0);
      if(expected.qr) {
        assert.ok(modules.length>100);
        assert.ok(Math.abs(modules[0][0]-20*mm)<.000001);
        assert.ok(Math.abs(page.getHeight()-modules[0][1]-20*mm)<.000001);
      }
      const text = [...content.matchAll(/BT\n([\s\S]*?)ET/g)].map(match=>{
        const position = match[1].match(/1 0 0 1 ([-\d.]+) ([-\d.]+) Tm/);
        const label = match[1].match(/<([a-f\d]*)> Tj/i);
        const font = match[1].match(/\/([^\s]+) ([\d.]+) Tf/);
        assert.equal(Number(font[2]),12);
        assert.equal(pdf.context.lookup(fonts.get(PDFName.of(font[1]))).get(PDFName.of("BaseFont")).toString(),"/Helvetica");
        assert.match(match[1],/0 0 0 rg/);
        return {x:Number(position[1]),y:Number(position[2]),text:Buffer.from(label[1],"hex").toString("latin1")};
      });
      assert.deepEqual(text.map(line=>line.text),expected.text.map(line=>line.text),"No text, spaces or lines may be lost or truncated");
      for(const [lineIndex,line] of text.entries()) {
        // Source's independently serialized coordinates, not renderer-derived
        // expectations or a below-QR constraint that Source does not satisfy.
        assert.ok(Math.abs(line.x-expected.text[lineIndex].x)<0.001);
        assert.ok(Math.abs(line.y-expected.text[lineIndex].y)<0.001);
      }
    }
  });
}

test("default and explicit Rewrite PDFs retain the existing centered 80 mm QR geometry",async()=>{
  const input={attachments:[attachment],labelTemplate:"Own label"};
  const [defaultPage] = await rendered(input);
  const [explicitPage] = await rendered({...input,layout:"rewrite"});
  assert.equal(defaultPage.content,explicitPage.content);
  assert.equal(defaultPage.imageCount,1); assert.equal(explicitPage.imageCount,1);
  near(defaultPage.matrix[0],226.77); near(defaultPage.matrix[3],226.77);
  near(defaultPage.matrix[4],(595.28-226.77)/2);
  near(defaultPage.matrix[5],841.89-56.69-38-22-226.77-40);
});

test("Original PDF matches rendered Source regular Helvetica 12 and excludes handoff captions/footer",async()=>{
  const [{content,fonts,pdf,nativeQrCount}] = await rendered({attachments:[attachment],layout:"original",labelTemplate:"Own label"});
  assert.equal(nativeQrCount,1);
  assert.equal(pdf.getCreator(),"IQB-Testcenter");
  const text = [...content.matchAll(/\/([^\s]+) ([\d.]+) Tf/g)];
  assert.equal(text.length,1,"Only the authored label is visible text");
  assert.equal(Number(text[0][2]),12);
  const font = pdf.context.lookup(fonts.get(PDFName.of(text[0][1])));
  assert.equal(font.get(PDFName.of("BaseFont")).toString(),"/Helvetica");
  assert.match(content,/0 0 0 rg/);
  assert.equal([...content.matchAll(/<[a-f\d]+> Tj/gi)].length,1);
  const encodedLabel = Buffer.from("Own label","ascii").toString("hex");
  assert.match(content,new RegExp(`<${encodedLabel}> Tj`,"i"));
});

const bookmarkReference = JSON.parse(await readFile(
  new URL("./fixtures/original-attachment-pdf-bookmarks.json",import.meta.url),"utf8"));
for(const reference of bookmarkReference.cases) {
  test(`Original PDF bookmark navigation matches actual Source: ${reference.name}`,async()=>{
    const pdf = await PDFDocument.load(await createAttachmentPagesPdf({layout:"original",
      labelTemplate:reference.labelTemplate,attachments:[
        {...attachment,attachmentId:"1:Own Unit:own-image",personLabel:"Own Group/own-login/own-code",bookletKey:"Own Booklet",unitKey:"Own Unit"},
        {...attachment,attachmentId:"2:Own Second Unit:own-second-image",personLabel:"Own Group/own-second-login/own-second-code",bookletKey:"Own Second Booklet",unitKey:"Own Second Unit",variableId:"own-second-image"}
      ]}));
    assert.equal(pdf.getPageCount(),reference.pageCount);
    assert.equal(pdf.catalog.get(PDFName.of("PageMode")).toString(),reference.pageMode);
    const rootRef=pdf.catalog.get(PDFName.of("Outlines"));
    const root=pdf.context.lookup(rootRef);
    assert.equal(root.get(PDFName.of("Type")).toString(),"/Outlines");
    let ref=root.get(PDFName.of("First"));
    let previous;
    for(const expected of reference.items) {
      assert.ok(ref,"Every scoped attachment has its Source bookmark");
      const item=pdf.context.lookup(ref);
      assert.equal(item.get(PDFName.of("Title")).decodeText(),expected.title);
      assert.equal(item.get(PDFName.of("Parent")).toString(),rootRef.toString());
      assert.equal(item.get(PDFName.of("Prev"))?.toString(),previous?.toString());
      assert.equal(item.get(PDFName.of("F")).asNumber(),expected.flags);
      assert.deepEqual(item.lookup(PDFName.of("C"),PDFArray).asArray().map(value=>value.asNumber()),expected.color);
      assert.equal(item.get(PDFName.of("A")),undefined,"Bookmarks never add script/external actions");
      const destination=item.lookup(PDFName.of("Dest"),PDFArray);
      assert.equal(destination.get(0).toString(),pdf.getPages()[expected.page].ref.toString());
      assert.equal(destination.get(1).toString(),expected.view);
      near(destination.get(2).asNumber(),expected.x); near(destination.get(3).asNumber(),expected.y);
      assert.equal(destination.get(4),PDFNull);
      previous=ref;ref=item.get(PDFName.of("Next"));
    }
    assert.equal(ref,undefined,"No foreign or duplicate attachment bookmark is appended");
    assert.equal(root.get(PDFName.of("Last")).toString(),previous.toString());
  });
}

test("default and explicit Rewrite retain their existing viewer mode without Original bookmarks",async()=>{
  for(const layout of [undefined,"rewrite"]) {
    const pdf=await PDFDocument.load(await createAttachmentPagesPdf({attachments:[attachment],layout}));
    assert.equal(pdf.catalog.get(PDFName.of("Outlines")),undefined);
    assert.equal(pdf.catalog.get(PDFName.of("PageMode")),undefined);
  }
});
