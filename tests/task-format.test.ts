import test from "node:test";
import assert from "node:assert/strict";
import { taskReport, friendlyData } from "../src/task-format";
test("task answers are readable, attributed, and honest about dates", () => {
  const answer = taskReport(
    [
      {
        project: "Website",
        tasks: [
          {
            title: "Review landing page",
            status: "inProgress",
            assignee: { name: "Abhinand" },
            dueDate: "2026-10-01",
          },
        ],
      },
      { project: "Empty", tasks: [] },
    ],
    "Abhinand",
    new Date("2026-10-01T00:00:00Z"),
  );
  assert.match(answer, /Abhinand/);
  assert.match(answer, /Review landing page/);
  assert.match(answer, /In progress/);
  assert.match(answer, /does not filter/);
  assert.doesNotMatch(answer, /Empty\n|"title"|\{"/);
  assert.match(
    friendlyData({ projects: [{ name: "Website", progress: 50 }] }),
    /Website/,
  );
});

import { argumentsFor } from "../src/mcp";
test("personal and teammate task commands resolve the intended assignee", () => {
  for (const query of ["Show my tasks", "What are my tasks today?", "my task"])
    assert.equal(
      argumentsFor('{"assignee":"{{assignee}}"}', query, "").assignee,
      "me",
    );
  for (const query of [
    "Check Santhosh task",
    "Show Santhosh’s tasks",
    "Santhosh tasks",
  ])
    assert.equal(
      argumentsFor('{"assignee":"{{assignee}}"}', query, "").assignee,
      "Santhosh",
    );
});

import { replyHTML, spokenReply } from "../src/reply-view";
test("task tables render safely in chat and pet replies", () => {
  const text = taskReport(
    [
      {
        project: "Website",
        tasks: [
          {
            title: "<script>alert(1)</script> | review",
            status: "todo",
            assignee: "Abhinand",
          },
        ],
      },
    ],
    "Abhinand",
    new Date(),
  );
  const html = replyHTML(text);
  assert.match(html, /<table/);
  assert.match(html, /<th>Assigned to<\/th>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /review/);
  assert.doesNotMatch(spokenReply(text), /\|/);
  assert.doesNotMatch(replyHTML('Source: Loom\n\n[{"id":1}]'), /\{"/);
});

test("spoken replies omit emoji without removing Malayalam or numbers", () => {
  assert.equal(
    spokenReply("നമസ്കാരം 😄 👩‍💻 🇮🇳 1️⃣ Task 42").replace(/\s+/g, " ").trim(),
    "നമസ്കാരം Task 42",
  );
});
