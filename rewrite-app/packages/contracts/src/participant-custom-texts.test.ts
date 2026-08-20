import assert from "node:assert/strict";
import test from "node:test";

import {
  formatOriginalCustomText,
  mergeParticipantCustomTextScopes,
  originalParticipantCustomTextDefaults,
  originalParticipantCustomTextKeys,
  resolveAndFormatParticipantCustomText,
  resolveParticipantCustomText
} from "./participant-custom-texts.js";

const currentOriginalParticipantCustomTextKeys = [
  "booklet_blockLockedByAfterLeave",
  "booklet_codeToEnterPrompt",
  "booklet_codeToEnterTitle",
  "booklet_errormessage",
  "booklet_loading",
  "booklet_lockedBlock",
  "booklet_lockedByAfterLeave",
  "booklet_msgNavigationDeniedText_presentationIncomplete",
  "booklet_msgNavigationDeniedText_responsesIncomplete",
  "booklet_msgNavigationDeniedTitle",
  "booklet_msgSoonTimeOver",
  "booklet_msgTimeOver",
  "booklet_msgTimerCancelled",
  "booklet_msgTimerStarted",
  "booklet_pausedmessage",
  "booklet_requestFullscreen",
  "booklet_starterContinueTestButtonLabel",
  "booklet_starterLockedTestButtonLabel",
  "booklet_starterStartTestButtonLabel",
  "booklet_starterViewTestButtonLabel",
  "booklet_tasklisttitle",
  "booklet_warningLeaveTextPrompt-testlet",
  "booklet_warningLeaveTextPrompt-unit",
  "booklet_warningLeaveTimerBlockTextPrompt",
  "booklet_warningLeaveTimerBlockTitle",
  "booklet_warningLeaveTitle-testlet",
  "booklet_warningLeaveTitle-unit",
  "login_bookletSelectPromptMany",
  "login_bookletSelectPromptNull",
  "login_bookletSelectPromptOne",
  "login_codeInputErrorBody",
  "login_codeInputErrorTitle",
  "login_codeInputPrompt",
  "login_codeInputTitle",
  "login_pagesNaviPrompt",
  "login_sidepanel_subtitle",
  "login_sidepanel_title",
  "login_subtitle",
  "login_testEndButtonLabel",
  "login_testResumeButtonLabel",
  "login_unsupportedBrowser"
] as const;

test("participant custom-text scopes follow original global-login-booklet precedence", () => {
  assert.deepEqual(
    mergeParticipantCustomTextScopes(
      {
        login_subtitle: "Global selection",
        booklet_loading: "Global loading"
      },
      {
        login_subtitle: "Workspace selection",
        booklet_loading: "Workspace loading"
      },
      { booklet_loading: "Booklet loading" }
    ),
    {
      login_subtitle: "Workspace selection",
      booklet_loading: "Booklet loading"
    }
  );
});

test("participant custom-text catalog preserves the complete original key set", () => {
  assert.equal(currentOriginalParticipantCustomTextKeys.length, 41);
  assert.equal(originalParticipantCustomTextKeys.length, 42);
  assert.equal(
    (currentOriginalParticipantCustomTextKeys as readonly string[]).includes(
      "booklet_codeToEnterWarning"
    ),
    false
  );
  assert.equal(
    (originalParticipantCustomTextKeys as readonly string[]).includes(
      "booklet_console_warning"
    ),
    false
  );
  assert.equal(
    [
      "booklet_loadingBlock",
      "booklet_loadingUnit",
      "booklet_unitLoadingUnknownProgress",
      "booklet_unitLoadingPending",
      "booklet_unitLoading"
    ].every(
      key =>
        !(originalParticipantCustomTextKeys as readonly string[]).includes(key)
    ),
    true
  );
  assert.equal(
    (originalParticipantCustomTextKeys as readonly string[]).includes(
      "booketlet_continueButtonLockedUnit"
    ),
    false
  );
  assert.equal(
    currentOriginalParticipantCustomTextKeys.every(key =>
      originalParticipantCustomTextKeys.includes(key)
    ),
    true
  );
  assert.deepEqual(
    [...originalParticipantCustomTextKeys].sort(),
    [
      "booklet_blockLockedByAfterLeave",
      "booklet_codeToEnterPrompt",
      "booklet_codeToEnterTitle",
      "booklet_errormessage",
      "booklet_loading",
      "booklet_lockedBlock",
      "booklet_lockedByAfterLeave",
      "booklet_msgNavigationDeniedText_presentationIncomplete",
      "booklet_msgNavigationDeniedText_responsesIncomplete",
      "booklet_msgNavigationDeniedTitle",
      "booklet_msgSoonTimeOver",
      "booklet_msgTimeOver",
      "booklet_msgTimerCancelled",
      "booklet_msgTimerStarted",
      "booklet_pausedmessage",
      "booklet_reload",
      "booklet_requestFullscreen",
      "booklet_starterContinueTestButtonLabel",
      "booklet_starterLockedTestButtonLabel",
      "booklet_starterStartTestButtonLabel",
      "booklet_starterViewTestButtonLabel",
      "booklet_tasklisttitle",
      "booklet_warningLeaveTextPrompt-testlet",
      "booklet_warningLeaveTextPrompt-unit",
      "booklet_warningLeaveTimerBlockTextPrompt",
      "booklet_warningLeaveTimerBlockTitle",
      "booklet_warningLeaveTitle-testlet",
      "booklet_warningLeaveTitle-unit",
      "login_bookletSelectPromptMany",
      "login_bookletSelectPromptNull",
      "login_bookletSelectPromptOne",
      "login_codeInputErrorBody",
      "login_codeInputErrorTitle",
      "login_codeInputPrompt",
      "login_codeInputTitle",
      "login_pagesNaviPrompt",
      "login_sidepanel_subtitle",
      "login_sidepanel_title",
      "login_subtitle",
      "login_testEndButtonLabel",
      "login_testResumeButtonLabel",
      "login_unsupportedBrowser"
    ].sort()
  );
  assert.equal(
    originalParticipantCustomTextDefaults.booklet_warningLeaveTimerBlockTextPrompt,
    "Du verlässt einen zeitbeschränkten Bereich und kannst nicht zurückkehren."
  );
  assert.equal(
    originalParticipantCustomTextDefaults["booklet_warningLeaveTextPrompt-testlet"],
    "Du verlässt einen Bereich zu dem du später nicht zurückkehren kannst."
  );
  assert.equal(
    originalParticipantCustomTextDefaults["booklet_warningLeaveTextPrompt-unit"],
    "Du verlässt eine Aufgabe zu der du später nicht zurückkehren kannst."
  );
  assert.equal(
    originalParticipantCustomTextDefaults.login_unsupportedBrowser,
    "Ihr Browser %s %s ist veraltet und könnte zu Fehlern führen. Bitte verwenden Sie eine aktuelle Version."
  );
});

test("participant custom-text resolution keeps authored copy and safe fallbacks", () => {
  assert.equal(
    resolveParticipantCustomText(
      { login_subtitle: "  Project Test Selection  " },
      "login_subtitle",
      "Start or Resume Test"
    ),
    "Project Test Selection"
  );
  assert.equal(
    resolveParticipantCustomText(
      { login_subtitle: "   " },
      "login_subtitle",
      "Start or Resume Test"
    ),
    "Start or Resume Test"
  );
  assert.equal(
    resolveParticipantCustomText(undefined, "login_subtitle"),
    "Testauswahl"
  );
});

test("original percent-s placeholders are substituted sequentially", () => {
  assert.equal(
    formatOriginalCustomText("Browser %s %s; %s remains", ["Firefox", 128]),
    "Browser Firefox 128; %s remains"
  );
  assert.equal(
    resolveAndFormatParticipantCustomText(
      { booklet_msgSoonTimeOver: "%s minutes remain" },
      "booklet_msgSoonTimeOver",
      [5]
    ),
    "5 minutes remain"
  );
});
