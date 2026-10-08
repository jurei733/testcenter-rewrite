import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeParticipantAccessBoundary,
  resolveParticipantSessionValidUntil
} from "./index.js";

describe("participant access windows", () => {
  it("interprets Original Testcenter calendar values in the configured timezone", () => {
    assert.equal(
      normalizeParticipantAccessBoundary("1/6/2023 10:00", "Europe/Berlin"),
      "2023-06-01T08:00:00.000Z"
    );
    assert.equal(
      normalizeParticipantAccessBoundary("1/1/20 12:00", "Europe/Berlin"),
      "2020-01-01T11:00:00.000Z"
    );
    assert.equal(
      normalizeParticipantAccessBoundary("١/٦/٢٠٢٣ ١٠:٠٠", "Europe/Berlin"),
      "2023-06-01T08:00:00.000Z"
    );
    assert.equal(
      normalizeParticipantAccessBoundary("𝟙/𝟞/𝟚𝟘𝟚𝟛_𝟙𝟘:𝟘𝟘", "Europe/Berlin"),
      "2023-06-01T08:00:00.000Z"
    );
    assert.equal(
      normalizeParticipantAccessBoundary("2026-01-01T08:00:00Z"),
      "2026-01-01T08:00:00.000Z"
    );
    assert.equal(
      normalizeParticipantAccessBoundary("31/3/2024 02:30", "Europe/Berlin"),
      null
    );
  });

  it("uses the earlier absolute or relative session expiration", () => {
    assert.equal(
      resolveParticipantSessionValidUntil(
        {
          validTo: "2026-01-01T10:30:00.000Z",
          validForMinutes: 45
        },
        "2026-01-01T10:00:00.000Z"
      ),
      "2026-01-01T10:30:00.000Z"
    );
    assert.equal(
      resolveParticipantSessionValidUntil(
        { validTo: null, validForMinutes: 45 },
        "2026-01-01T10:00:00.000Z"
      ),
      "2026-01-01T10:45:00.000Z"
    );
    assert.equal(
      resolveParticipantSessionValidUntil(
        { validTo: null, validForMinutes: null },
        "2026-01-01T10:00:00.000Z"
      ),
      null
    );
  });
});
