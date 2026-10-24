// Match Original Testtakers' direct CustomTexts children without treating XML
// comments, CDATA or a self-closing sibling as an opening element's contents.
const decodeCustomTextXml = (value: string): string =>
  value.replace(/\r\n?/g, "\n").replace(
    /&(?:#x([\da-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
    (reference, hex: string | undefined, decimal: string | undefined, name: string | undefined) => {
      if (name) return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[name] ?? reference;
      const point = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : reference;
    }
  );

export function parseXmlRosterCustomTexts(xml: string): Record<string, string> {
  const entries: Array<[string, string]> = [];
  const stack: string[] = [];
  let active: { key: string; text: string; depth: number } | null = null;
  const finish = (): void => {
    if (active) entries.push([active.key, active.text]);
    active = null;
  };
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:"[^"]*"|'[^']*'|[^'"<>])*>|[^<]+/g;
  for (const match of xml.matchAll(tokens)) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      if (active && stack.length === active.depth) active.text += token.slice(9, -3).replace(/\r\n?/g, "\n");
      continue;
    }
    if (!token.startsWith("<")) {
      if (active && stack.length === active.depth) active.text += decodeCustomTextXml(token);
      continue;
    }
    const nameMatch = /^<\/?([A-Za-z_][\w:.-]*)/.exec(token);
    if (!nameMatch) continue;
    const name = nameMatch[1]!.split(":").at(-1)!.toLowerCase();
    if (token.startsWith("</")) {
      if (active && stack.length === active.depth && stack.at(-1) === name) finish();
      if (stack.at(-1) === name) stack.pop();
      continue;
    }
    if (name === "customtext" && stack.length === 2 && stack[0] === "testtakers" && stack[1] === "customtexts") {
      const attributes = [...token.slice(nameMatch[0].length).matchAll(
        /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      )];
      const keyAttribute = attributes.find(attribute => attribute[1]!.toLowerCase() === "key");
      const key = keyAttribute ? decodeCustomTextXml(keyAttribute[2] ?? keyAttribute[3] ?? "").trim() : "";
      if (key) active = { key, text: "", depth: stack.length + 1 };
    }
    if (/\/\s*>$/.test(token)) {
      if (active && active.depth === stack.length + 1) finish();
    } else stack.push(name);
  }
  return Object.fromEntries(entries);
}

// Preserve CDATA's literal text while preventing instruction/comment/data
// examples from being mistaken for real Login, Group or Profile elements.
export function prepareXmlRosterStructure(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, token =>
    token.startsWith("<![CDATA[")
      ? token.slice(9, -3).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : ""
  );
}
