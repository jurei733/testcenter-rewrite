import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";

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
    const image = content.split("q\n").find(block=>/\/Image[^\s]* Do/.test(block));
    assert.ok(image,"A real QR image must be embedded");
    const transforms = [...image.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(match=>match.slice(1).map(Number));
    let matrix = [1,0,0,1,0,0];
    for(const [a,b,c,d,e,f] of transforms) {
      const [aa,bb,cc,dd,ee,ff]=matrix;
      matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];
    }
    const fonts = page.node.Resources().lookup(PDFName.of("Font"));
    return {page,content,matrix,fonts,pdf};
  });
}

test("Original printed QR occupies the current Source 20/20/40/40 mm region on every A4 page",async()=>{
  const rows = await rendered({attachments:[attachment,{...attachment,attachmentId:"second-owned-qr"}],layout:"original",labelTemplate:"Own long label ".repeat(30)});
  assert.equal(rows.length,2);
  for(const {page,matrix,content} of rows) {
    near(page.getWidth(),595.28); near(page.getHeight(),841.89);
    near(matrix[0],40*mm); near(matrix[3],40*mm);
    near(matrix[4],20*mm); near(page.getHeight()-matrix[5]-matrix[3],20*mm);
    near(matrix[1],0); near(matrix[2],0);
    // Label wrapping and code captions cannot obscure the scanning region.
    for(const match of content.matchAll(/1 0 0 1 [-\d.]+ ([-\d.]+) Tm/g))
      assert.ok(Number(match[1])+16 < matrix[5],"Text remains below the QR region");
  }
});

test("default and explicit Rewrite PDFs retain the existing centered 80 mm QR geometry",async()=>{
  const input={attachments:[attachment],labelTemplate:"Own label"};
  const [defaultPage] = await rendered(input);
  const [explicitPage] = await rendered({...input,layout:"rewrite"});
  assert.equal(defaultPage.content,explicitPage.content);
  near(defaultPage.matrix[0],226.77); near(defaultPage.matrix[3],226.77);
  near(defaultPage.matrix[4],(595.28-226.77)/2);
  near(defaultPage.matrix[5],841.89-56.69-38-22-226.77-40);
});

test("Original PDF matches rendered Source regular Helvetica 12 and excludes handoff captions/footer",async()=>{
  const [{content,fonts,pdf}] = await rendered({attachments:[attachment],layout:"original",labelTemplate:"Own label"});
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
