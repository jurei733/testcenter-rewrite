/** Driver codes are useful in operator logs; request bodies and SQL bindings are not. */
export const runtimeErrorDetails = (error: unknown): Record<string, string | number> => {
  if (!(error instanceof Error)) return { message: String(error) };
  const details: Record<string, string | number> = { name: error.name, message: error.message };
  const driver = error as Error & { code?: unknown; errcode?: unknown; errstr?: unknown };
  if (typeof driver.code === "string" && /^[A-Z0-9_]{1,64}$/.test(driver.code)) details.code = driver.code;
  if (driver.code === "ERR_SQLITE_ERROR") {
    if (typeof driver.errcode === "number" && Number.isSafeInteger(driver.errcode) && driver.errcode >= 0) details.sqliteCode = driver.errcode;
    if (typeof driver.errstr === "string" && driver.errstr.length <= 512) details.sqliteDescription = driver.errstr;
  }
  return details;
};
