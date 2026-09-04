import assert from "node:assert/strict";
import test from "node:test";

import {
  adminPasswordPolicy,
  getAdminPasswordPolicyViolation
} from "./index.js";

test("admin password policy distinguishes length and pattern violations", () => {
  assert.equal(
    getAdminPasswordPolicyViolation("1234567"),
    "minimum_length"
  );
  assert.equal(
    getAdminPasswordPolicyViolation(
      "x".repeat(adminPasswordPolicy.maximumLength + 1)
    ),
    "maximum_length"
  );
  assert.equal(
    getAdminPasswordPolicyViolation("PolicyAdmin123!", {
      minimumLength: 12,
      maximumLength: 60,
      pattern: "^(?=.*[A-Z])(?=.*\\d).+$"
    }),
    null
  );
  assert.equal(
    getAdminPasswordPolicyViolation("lowercase-password-123", {
      minimumLength: 12,
      maximumLength: 60,
      pattern: "^(?=.*[A-Z])(?=.*\\d).+$"
    }),
    "pattern"
  );
  assert.equal(
    getAdminPasswordPolicyViolation("PolicyAdmin123!", {
      minimumLength: 12,
      maximumLength: 60,
      pattern: "["
    }),
    "pattern"
  );
});
