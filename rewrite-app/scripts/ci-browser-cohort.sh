#!/usr/bin/env bash
# A cheap rejection before dependency installation. This never substitutes for
# authenticated artifact, exact context, dpkg and font validation on restore.
set -euo pipefail
valid_version() { [[ "$1" =~ ^[A-Za-z0-9._-]{1,80}$ ]]; }
if [[ "${ImageOS:-}" != ubuntu24 ]] || ! valid_version "${ImageVersion:-}"; then
  printf '%s\n' 'Browser cohort requires an exact Ubuntu 24 runner image.' >&2
  exit 1
fi
case "${1:-}" in
  record)
    [[ -n "${GITHUB_OUTPUT:-}" ]] || { printf '%s\n' 'Missing cohort output file.' >&2; exit 1; }
    printf 'image-version=%s\n' "$ImageVersion" >> "$GITHUB_OUTPUT"
    ;;
  check)
    valid_version "${CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION:-}" || {
      printf '%s\n' 'Missing or invalid producer browser image version.' >&2; exit 1;
    }
    if [[ "$ImageVersion" != "$CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION" ]]; then
      printf 'Browser runner image cohort mismatch: producer=%s consumer=%s. No dependencies or browser packages installed.\n' \
        "$CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION" "$ImageVersion" >&2
      exit 1
    fi
    printf 'Browser runner image cohort matches producer: %s; full artifact validation remains required.\n' "$ImageVersion"
    ;;
  *) printf '%s\n' 'Expected record or check.' >&2; exit 1 ;;
esac
