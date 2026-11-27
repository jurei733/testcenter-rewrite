function isCanonicalHost(hostname: string, parsed: URL): boolean {
  if (hostname.startsWith("[")) return true;
  const host = hostname.toLowerCase();
  const dns = host.replace(/\.$/u, "");
  const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
  return parsed.hostname === host && dns.length <= 253 &&
    dns.split(".").every(label => dnsLabel.test(label));
}

export function parsePublicNativeApiBaseUrl(source: string | undefined): string | undefined {
  if (!source) return undefined;
  const parts = /^https?:\/\/(?<host>\[[a-f0-9:.]+\]|[a-z0-9.-]+)(?::[0-9]+)?(?<mount>\/[^?#]*)?$/iu.exec(source)?.groups;
  const mount = parts?.mount ?? "/";
  const url = URL.parse(source);
  if (!parts || !url || /[\s\\\u0000-\u001f\u007f]/u.test(source) ||
      !isCanonicalHost(parts.host, url) || url.pathname !== mount ||
      mount.includes("//") || mount.includes("%")) {
    throw new Error(
      "FIRST_SLICE_PUBLIC_NATIVE_API_BASE_URL must be an absolute HTTP(S) URL with a canonical host and mount, without credentials, a query, or a fragment."
    );
  }
  return url.origin + mount.replace(/\/$/u, "");
}
