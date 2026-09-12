const localDemoPlayerKey = "testcenter-demo-player@1.0";

const localDemoPlayerHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Testcenter demo player</title>
    <script type="application/ld+json">
      {
        "type": "player",
        "id": "testcenter-demo-player",
        "name": [{ "value": "Testcenter Demo Player", "lang": "en" }],
        "version": "1.0.0",
        "specVersion": "6.0",
        "description": [{ "value": "Self-contained Verona player for the local Testcenter demo.", "lang": "en" }],
        "maintainer": {
          "name": [{ "value": "Testcenter Rewrite", "lang": "en" }]
        },
        "code": {
          "licenseType": "MIT"
        },
        "metadataVersion": "2.0"
      }
    </script>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17213a;
        background: #f5f7fb;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        padding: clamp(1rem, 4vw, 2.5rem);
        display: grid;
        place-items: center;
      }

      main {
        width: min(46rem, 100%);
        padding: clamp(1.25rem, 4vw, 2.5rem);
        border: 1px solid #dfe5f0;
        border-radius: 1.25rem;
        background: #ffffff;
        box-shadow: 0 1.25rem 3rem rgba(36, 52, 89, 0.12);
      }

      .eyebrow {
        margin: 0 0 0.75rem;
        color: #52627c;
        font-size: 0.75rem;
        font-weight: 750;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(1.6rem, 5vw, 2.35rem);
        line-height: 1.12;
      }

      #demoPlayerInstruction {
        margin: 0.9rem 0 1.5rem;
        color: #52627c;
        font-size: 1rem;
        line-height: 1.6;
      }

      label {
        display: grid;
        gap: 0.6rem;
        color: #263653;
        font-weight: 700;
      }

      textarea {
        width: 100%;
        min-height: 8.5rem;
        resize: vertical;
        padding: 0.9rem 1rem;
        border: 2px solid #cbd5e5;
        border-radius: 0.8rem;
        color: #17213a;
        background: #fbfcff;
        font: inherit;
        line-height: 1.5;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }

      textarea:focus {
        border-color: #3157c8;
        box-shadow: 0 0 0 4px rgba(49, 87, 200, 0.14);
        outline: none;
      }

      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1rem;
        color: #66758d;
        font-size: 0.82rem;
      }

      #demoPlayerAnswerStatus {
        color: #20734a;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Verona API 6 demo unit</p>
      <h1 id="demoPlayerTitle">Loading unit…</h1>
      <p id="demoPlayerInstruction">The unit definition is being prepared.</p>
      <label for="demoPlayerAnswer">
        <span id="demoPlayerQuestion">Your answer</span>
        <textarea id="demoPlayerAnswer" autocomplete="off"></textarea>
      </label>
      <footer>
        <span>Responses are saved by the Testcenter host.</span>
        <span id="demoPlayerAnswerStatus" role="status" aria-live="polite">Not answered</span>
      </footer>
    </main>
    <script>
      (() => {
        const answer = document.querySelector("#demoPlayerAnswer");
        const title = document.querySelector("#demoPlayerTitle");
        const instruction = document.querySelector("#demoPlayerInstruction");
        const question = document.querySelector("#demoPlayerQuestion");
        const status = document.querySelector("#demoPlayerAnswerStatus");
        let sessionId = "";

        const readDefinition = rawDefinition => {
          try {
            const parsed = JSON.parse(rawDefinition);
            return parsed && typeof parsed === "object" ? parsed : {};
          } catch {
            return { instruction: rawDefinition };
          }
        };

        const updateStatus = () => {
          status.textContent = answer.value.trim() ? "Answer captured" : "Not answered";
        };

        const reportState = () => {
          if (!sessionId) return;
          const hasAnswer = Boolean(answer.value.trim());
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            unitState: {
              dataParts: { answer: answer.value },
              presentationProgress: "complete",
              responseProgress: hasAnswer ? "complete" : "none"
            },
            log: [{
              key: "DEMO_ANSWER_CHANGED",
              timeStamp: Date.now(),
              content: hasAnswer ? "answered" : "cleared"
            }]
          }, "*");
        };

        addEventListener("message", event => {
          if (event.data?.type !== "vopStartCommand") return;
          sessionId = String(event.data.sessionId || "");
          const definition = readDefinition(String(event.data.unitDefinition || ""));
          title.textContent = String(definition.title || event.data.playerConfig?.unitTitle || "Demo unit");
          instruction.textContent = String(definition.instruction || "Enter a response for this demo unit.");
          question.textContent = String(definition.question || "Your answer");
          answer.placeholder = String(definition.placeholder || "Type your answer here…");
          answer.value = String(event.data.unitState?.dataParts?.answer || "");
          updateStatus();
        });

        answer.addEventListener("input", () => {
          updateStatus();
          reportState();
        });

        addEventListener("focus", () => parent.postMessage({
          type: "vopWindowFocusChangedNotification",
          hasFocus: true
        }, "*"));
        addEventListener("blur", () => parent.postMessage({
          type: "vopWindowFocusChangedNotification",
          hasFocus: false
        }, "*"));

        setTimeout(() => parent.postMessage({
          type: "vopReadyNotification",
          metadata: { specVersion: "6.0" }
        }, "*"), 0);
      })();
    </script>
  </body>
</html>`;

const localDemoUnits = [
  {
    unitKey: "unit-intro",
    displayLabel: "Introduction",
    description: "Demo introduction task",
    content: "Describe what you see in the demo introduction.",
    unitDefinition: JSON.stringify({
      title: "Welcome to the interactive demo",
      instruction:
        "This response field runs inside a sandboxed Verona Player and is saved by the Participant runtime.",
      question: "What would you like to verify in this demo?",
      placeholder: "For example: response restoration and live monitoring"
    })
  },
  {
    unitKey: "unit-practice",
    displayLabel: "Practice",
    content: "Save a practice response.",
    unitDefinition: JSON.stringify({
      title: "Practice response persistence",
      instruction:
        "Enter another response, move between units, and observe the saved state in the monitor and administration views.",
      question: "Record a short practice response",
      placeholder: "This response is persisted through Verona state updates"
    })
  },
  {
    unitKey: "unit-finish",
    displayLabel: "Finish",
    content: "Complete the demo test.",
    unitDefinition: JSON.stringify({
      title: "Complete the demo booklet",
      instruction:
        "Use this final unit to verify the completion boundary and the final saved response state.",
      question: "Add an optional final note",
      placeholder: "Ready to complete"
    })
  }
].map(unit => ({
  ...unit,
  playerKey: localDemoPlayerKey,
  unitDefinitionType: "application/vnd.testcenter.demo+json"
}));

export const localDemoSourcePackage = {
  fileName: "demo-assessment.json",
  mediaType: "application/json",
  sourceDocument: JSON.stringify({
    playerEntries: [
      {
        playerKey: localDemoPlayerKey,
        html: localDemoPlayerHtml
      }
    ],
    bookletEntries: [
      {
        bookletKey: "booklet:demo",
        displayLabel: "Demo Booklet",
        config: {
          toolbar_show_unit_list: "TRUE",
          unit_menu: "FULL",
          unit_navibuttons: "FULL",
          restore_current_page_on_return: "ON",
          logPolicy: "rich"
        },
        unitEntries: localDemoUnits
      }
    ]
  })
} as const;
