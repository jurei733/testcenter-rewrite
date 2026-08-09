import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assessBrowserCompatibility,
  browserMatchesSupportedList,
  parseBrowserUserAgent,
  projectTestcenterLoadEnvironment
} from "./browser-compatibility.js";

const referenceSupportedBrowsers = [
  "chrome 121",
  "chrome 120",
  "firefox 122",
  "firefox 121",
  "firefox 115",
  "ios_saf 17.3",
  "ios_saf 17.2",
  "safari 17.3",
  "safari 17.2"
];

test("original browser policy accepts listed and newer browser versions", () => {
  const supportedUserAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.9.3281.78 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
  ];

  for (const userAgent of supportedUserAgents) {
    assert.equal(
      assessBrowserCompatibility(userAgent, referenceSupportedBrowsers).supported,
      true,
      userAgent
    );
  }
});

test("original browser policy rejects outdated and unknown browser families", () => {
  const unsupportedUserAgents = [
    "Mozilla/5.0 (Android 13; Mobile; rv:102.0) Gecko/102.0 Firefox/102.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36 Vivaldi/3.7",
    "NCSA Mosaic/3.0 (Windows 95)",
    "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; Touch; rv:11.0) like Gecko"
  ];

  for (const userAgent of unsupportedUserAgents) {
    assert.equal(
      assessBrowserCompatibility(userAgent, referenceSupportedBrowsers).supported,
      false,
      userAgent
    );
  }
});

test("browser parser preserves display names and exact reported versions", () => {
  assert.deepEqual(
    parseBrowserUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/147.0.7727.15 Safari/537.36"
    ),
    { family: "Chrome", version: "147.0.7727.15" }
  );
  assert.deepEqual(
    parseBrowserUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1"
    ),
    { family: "iOS", version: "16.7.4" }
  );
});

test("load environment retains the original Testcenter field shape", () => {
  assert.deepEqual(
    projectTestcenterLoadEnvironment({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/147.0.7727.15 Safari/537.36",
      screenSizeWidth: 1280.4,
      screenSizeHeight: 720.4,
      loadTime: 42.6
    }),
    {
      browserVersion: "147.0.7727.15",
      browserName: "Chrome",
      osName: "Linux --",
      device: "",
      screenSizeWidth: 1280,
      screenSizeHeight: 720,
      loadTime: 43
    }
  );
  assert.deepEqual(
    projectTestcenterLoadEnvironment({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1",
      screenSizeWidth: 390,
      screenSizeHeight: 844,
      loadTime: -10
    }),
    {
      browserVersion: "16.7",
      browserName: "Mobile Safari",
      osName: "iOS 16.7.4",
      device: "Apple iPhone mobile",
      screenSizeWidth: 390,
      screenSizeHeight: 844,
      loadTime: 0
    }
  );
});

test("an invalid empty support list disables the warning like the original", () => {
  assert.equal(
    browserMatchesSupportedList({ family: "Unknown", version: "unknown" }, []),
    true
  );
});
