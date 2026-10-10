export const runtimeErrorCodes = [
  "session-id-missing", "unit-definition-missing", "wrong-session-id",
  "unit-definition-type-unsupported", "unit-state-type-unsupported", "runtime-error"
];

const notification = (key, code, message) => ({
  key, theme: "Primar", screen: "desktop", code, message,
  applicationCustomTexts: {}, loginCustomTexts: {}, bookletCustomTexts: {}
});

export const runtimeErrorContractCases = [
  ...runtimeErrorCodes.map(code => notification(`code-${code}`, code, `Owned ${code} Ω`)),
  notification("unknown-code", "future-error-code", "Owned unknown runtime Ω"),
  notification("missing-code", undefined, "Owned missing code Ω"),
  notification("empty-message", "runtime-error", ""),
  notification("whitespace-rich-message", "runtime-error", " \n  <b>Owned rich error</b><br>Second line Ω  \n "),
  ...["application", "login", "booklet"].flatMap(scope =>
    ["Primar", "Sekundar", "Erwachsene"].flatMap(theme =>
      ["desktop", "mobile"].map(screen => ({
        ...notification(`help-${scope}-${theme}-${screen}`, "runtime-error", "Owned custom-help runtime Ω"),
        theme, screen,
        applicationCustomTexts: {booklet_errormessage: "Application help Ω\nSecond application line"},
        loginCustomTexts: scope === "application" ? {} : {booklet_errormessage: "Login help Ω\nSecond login line"},
        bookletCustomTexts: scope !== "booklet" ? {} : {booklet_errormessage: "Booklet help Ω\nSecond booklet line"}
      }))
    )
  )
];

export const expectedRuntimeErrorHelp = scenario =>
  scenario.bookletCustomTexts.booklet_errormessage ??
  scenario.loginCustomTexts.booklet_errormessage ??
  scenario.applicationCustomTexts.booklet_errormessage ?? "";
