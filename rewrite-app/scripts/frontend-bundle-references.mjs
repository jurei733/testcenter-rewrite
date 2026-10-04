// Directory order is not a build manifest: retained lazy-loaded assets from a
// previous version must not make a current, valid index fail preflight.
export const selectFrontendEntryBundles = assetReferences => {
  const uniqueReferences = [...new Set(assetReferences)];
  const select = (pattern, kind) => {
    const matches = uniqueReferences.filter(reference => pattern.test(reference));
    if (matches.length !== 1) {
      throw Error(`Frontend index must reference exactly one hashed ${kind} bundle.`);
    }
    return matches[0];
  };
  return {
    mainBundle: select(/^main-.*\.js$/u, "main JavaScript"),
    stylesheetBundle: select(/^styles-.*\.css$/u, "stylesheet")
  };
};
