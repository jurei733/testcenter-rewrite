import { DOMParser } from '@xmldom/xmldom';
import iconv from 'iconv-lite';
const schema = 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json';
const sourceUpperCase = (value: string) => value.replace(/[a-z]/g, letter => letter.toUpperCase());
const isSourceTruthy = (value: string) => value !== '' && value !== '0';
const sourceScalarText = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value === 'boolean' ? (value ? '1' : '') : value === null ? '' : 'Array';
const phpMaxInteger = 9223372036854775807n;
const parseSourceInteger = (value: string | undefined): bigint => {
    const prefix = /^[\t\n\r\f\v ]*([+]?\d+(?:[eE][+]?\d+)?)/.exec(value ?? '')?.[1];
    if (!prefix)
        return 0n;
    let result: bigint;
    if (/[eE]/.test(prefix)) {
        const number = Number(prefix);
        if (!Number.isFinite(number))
            return 0n;
        result = BigInt(Math.trunc(number));
    }
    else
        result = BigInt(prefix);
    return result > phpMaxInteger ? phpMaxInteger : result;
};
const formatSourceVersion = (major: bigint, minor: bigint, patch: bigint, label: string) => {
    const text = `${major}.${minor}.${patch}${isSourceTruthy(label) ? '-' + label : ''}`;
    return text === '0.0.0' ? '' : text;
};
export function splitOriginalResourceVersion(value: string) {
    const parts = value.split(/[.-]/), major = parseSourceInteger(parts[0]), minor = parseSourceInteger(parts[1]), patch = parseSourceInteger(parts[2]), label = parts[3] ?? '';
    return { major, minor, patch, label, text: formatSourceVersion(major, minor, patch, label) };
}
export function guessOriginalResourceName(value: string) {
    const match = /^(\D+?)[@V-]?((\d+)(\.\d+)?(\.\d+)?(-\S+?)?)?(.\D{3,4})?$/.exec(value);
    const moduleId = match?.[1] ?? '', major = parseSourceInteger(match?.[3]), minor = parseSourceInteger(match?.[4]?.slice(1)), patch = parseSourceInteger(match?.[5]?.slice(1)), label = match?.[6]?.slice(1) ?? '';
    return { moduleId, major, minor, patch, label, text: formatSourceVersion(major, minor, patch, label) };
}
const readTranslation = (value: unknown, context: boolean): string => {
    // PHP's associative arrays represent both JSON lists and objects. Missing
    // translations are allowed; malformed selected values fail its string type.
    if (value == null) return '';
    if (typeof value !== 'object') throw new TypeError('Invalid translation type');
    const rows = value as Record<string, unknown>;
    const entries = Object.values(rows);
    if (!entries.length) return '';
    let chosen: unknown;
    if (context) chosen = rows.de ?? rows.en ?? entries[0];
    else {
        const property = (entry: unknown, key: string): unknown => {
            if (typeof entry === 'string') throw new TypeError('Invalid translation entry');
            return entry && typeof entry === 'object' ? (entry as Record<string, unknown>)[key] : undefined;
        };
        let preferred: unknown;
        for (const language of ['de', 'en']) {
            preferred = entries.find(entry => {
                const lang = property(entry, 'lang');
                return lang === language || lang === true;
            });
            if (preferred !== undefined) break;
        }
        chosen = property(preferred ?? rows['0'], 'value');
    }
    if (typeof chosen !== 'string') throw new TypeError('Invalid translation value');
    return chosen;
};
const allowedHtmlEncodings = new Set(['utf8', 'utf-8', 'utf16', 'utf-16', 'utf16le', 'utf-16le', 'utf16be', 'utf-16be', 'iso-8859-1', 'iso8859-1', 'latin1', 'windows-1252', 'cp1252', 'ascii', 'us-ascii', 'shift_jis', 'shift-jis', 'sjis', 'euc-jp', 'gb2312', 'gbk', 'big5']);
const parseSourceHtmlDocument = (text: string, sourceBytes?: Uint8Array) => {
    const bytes = sourceBytes ? Buffer.from(sourceBytes) : Buffer.from(text), parse = (value: string) => new DOMParser({ onError() { } }).parseFromString(value, 'text/html');
    try {
        let encoding = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'utf8' : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf16be' : '';
        if (encoding)
            return parse(iconv.decode(bytes, encoding));
        const ascii = bytes.toString('latin1');
        const declaration = /^\s*<\?xml\b[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(ascii)?.[1]?.toLowerCase();
        if (declaration && allowedHtmlEncodings.has(declaration))
            encoding = declaration;
        const initial = parse(ascii), tags = initial?.getElementsByTagName('meta');
        for (let i = 0; !encoding && i < (tags?.length ?? 0); i++) {
            const tag = tags!.item(i)!, declared = (tag.getAttribute('charset') || ((tag.getAttribute('http-equiv') ?? '').toLowerCase() === 'content-type' ? (/charset\s*=\s*([^\s;"']+)/i.exec(tag.getAttribute('content') ?? '')?.[1] ?? '') : '')).toLowerCase();
            if (allowedHtmlEncodings.has(declared))
                encoding = declared;
        }
        return encoding ? parse(iconv.decode(bytes, encoding)) : initial;
    }
    catch {
        return undefined;
    }
};
/** Inert Source ResourceFile metadata. Its HTML parser defaults to Latin-1;
 * original bytes are used so declared/BOM encodings remain meaningful. The
 * separate catalog channel never echoes arbitrary schema values or snippets. */
export function inspectOriginalHtmlResource(fileName: string, sourceText: string, sourceBytes?: Uint8Array) {
    const name = fileName.split(/[\\/]/).at(-1) ?? fileName;
    const warnings: string[] = [], catalogWarnings: string[] = [], info: string[] = [], errors: string[] = [];
    const warning = (message: string, catalogMessage = message) => { warnings.push(message); catalogWarnings.push(catalogMessage); };
    const document = parseSourceHtmlDocument(sourceText, sourceBytes), scripts = document?.getElementsByTagName('script');
    let raw: string | undefined;
    for (let i = 0; i < (scripts?.length ?? 0); i++)
        if (scripts!.item(i)?.getAttribute('type') === 'application/ld+json') {
            raw = scripts!.item(i)?.textContent ?? '';
            break;
        }
    let metadata: Record<string, unknown> | undefined, problem = 'No Metadata Element', catalogProblem = problem;
    if (raw !== undefined) {
        try {
            const value: unknown = raw === '' ? {} : JSON.parse(raw);
            metadata = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
            problem = metadata?.$schema == null ? 'Could not read metadata: $schema missing' : `Wrong metadata-schema: ${sourceScalarText(metadata.$schema)}`;
            catalogProblem = metadata?.$schema == null ? problem : 'Die Metadaten verwenden kein unterstütztes Schema.';
        }
        catch (error) {
            problem = 'Could not read metadata: JSON Error: ' + (/control character/i.test(String(error)) ? 'Unexpected control character found' : 'Syntax error, malformed JSON');
            catalogProblem = problem;
        }
    }
    const current = metadata?.$schema === schema, context = !current && metadata?.['@context'] === 'https://w3id.org/iqb/verona-modules';
    let moduleId = '', moduleType = '', rawVersion = '', veronaVersion: string | null = null, label = '', description = '';
    if (current || context) {
        const id = metadata?.[context ? '@id' : 'id'], declaredVersion = metadata?.version, spec = metadata?.[context ? 'apiVersion' : 'specVersion'], type = metadata?.[context ? '@type' : 'type'];
        if ([id, declaredVersion, spec, type].some(value => typeof value !== 'string'))
            errors.push('Die Modulmetadaten enthalten einen ungültigen Feldtyp.');
        moduleId = typeof id === 'string' ? id : '';
        moduleType = typeof type === 'string' ? type : '';
        rawVersion = typeof declaredVersion === 'string' ? declaredVersion : '';
        veronaVersion = typeof spec === 'string' ? spec : null;
        try {
            label = readTranslation(metadata?.name, context);
            description = readTranslation(metadata?.description, context);
        } catch {
            errors.push('Die Modulmetadaten enthalten einen ungültigen Feldtyp.');
        }
        if (context)
            warning('Deprecated meta-data-format found!');
    }
    else {
        label = document?.getElementsByTagName('title').item(0)?.textContent ?? '';
        const tags = document?.getElementsByTagName('meta');
        let legacy = false;
        for (let i = 0; i < (tags?.length ?? 0); i++) {
            const tag = tags!.item(i);
            if (tag?.getAttribute('name') !== 'application-name' || !isSourceTruthy(tag.getAttribute('content') ?? ''))
                continue;
            legacy = true;
            moduleId = tag.getAttribute('content') ?? '';
            moduleType = 'player';
            rawVersion = tag.getAttribute('data-version') ?? '';
            veronaVersion = tag.getAttribute('data-api-version') ?? '';
            description = tag.getAttribute('data-description') ?? '';
            warning('Metadata in meta-tag is deprecated!');
            break;
        }
        if (!legacy)
            warning(problem, catalogProblem);
    }
    let parsed = splitOriginalResourceVersion(rawVersion);
    if (!parsed.text) {
        const guessed = guessOriginalResourceName(name);
        moduleId = guessed.moduleId;
        parsed = guessed;
        warning('Metadata missing. Version guessed from Filename.');
    }
    if (!isSourceTruthy(label) && isSourceTruthy(moduleId))
        label = moduleId + (parsed.text ? '-' + parsed.text : '');
    if (veronaVersion && isSourceTruthy(veronaVersion))
        info.push(`Verona-Version: ${veronaVersion}`);
    if (isSourceTruthy(moduleId) && parsed.text) {
        const recommended = `${moduleId}-${parsed.major}.${parsed.minor}.html`;
        if (name !== recommended)
            warning(`Non-Standard-Filename: \`${recommended}\` expected.`);
    }
    return { identifier: sourceUpperCase(`${moduleId}-${parsed.major}.${parsed.minor}`), moduleId, effectiveVersion: parsed.text,
        moduleVersion: isSourceTruthy(moduleType) ? parsed.text : null, veronaVersion: isSourceTruthy(moduleType) ? veronaVersion : null, label, description, warnings, catalogWarnings, info, errors };
}
