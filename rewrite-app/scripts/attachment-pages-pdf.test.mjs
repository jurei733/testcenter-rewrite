import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
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
async function rendered(input) {
  const pdf = await PDFDocument.load(await createAttachmentPagesPdf(input));
  const pages = pdf.getPages();
  return pages.map(page => {
    const streams = pdf.context.lookup(page.node.Contents(), PDFArray);
    const content = Array.from({length:streams.size()},(_,i)=>Buffer.from(decodePDFRawStream(
      pdf.context.lookup(streams.get(i),PDFRawStream)).decode()).toString("ascii")).join("\n");
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
    return {page,content,matrix,fonts,pdf,imageCount:images.length};
  });
}

test("Original printed QR occupies the Source 20/20/40/40 mm region on each attachment's final label page",async()=>{
  const rows = await rendered({attachments:[attachment,{...attachment,attachmentId:"second-owned-qr"}],layout:"original",labelTemplate:"Own long label ".repeat(30)});
  assert.equal(rows.length,2);
  for(const {page,matrix,imageCount} of rows) {
    assert.ok(matrix,"Each five-line attachment page must contain its real QR");
    assert.equal(imageCount,1);
    near(page.getWidth(),595.276); near(page.getHeight(),841.89);
    near(matrix[0],40*mm); near(matrix[3],40*mm);
    near(matrix[4],20*mm); near(page.getHeight()-matrix[5]-matrix[3],20*mm);
    near(matrix[1],0); near(matrix[2],0);
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
    for(const [index,{page,content,matrix,fonts,pdf,imageCount}] of rows.entries()) {
      const expected = reference.pages[index];
      near(page.getWidth(),expected.width); near(page.getHeight(),expected.height);
      assert.equal(Boolean(matrix),expected.qr,"The QR belongs on the same Source page");
      assert.equal(imageCount,Number(expected.qr),"Exactly one QR per attachment, with none on earlier overflow pages");
      if(matrix) {
        near(matrix[0],40*mm); near(matrix[3],40*mm); near(matrix[4],20*mm);
        near(page.getHeight()-matrix[5]-matrix[3],20*mm);
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
  const [{content,fonts,pdf,imageCount}] = await rendered({attachments:[attachment],layout:"original",labelTemplate:"Own label"});
  assert.equal(imageCount,1);
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
