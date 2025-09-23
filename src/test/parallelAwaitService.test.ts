import * as assert from "assert";
import * as vscode from "vscode";
import { ParallelAwaitService, type ParallelAwaitPlanSuccess } from "../services/parallelAwaitService";

// Preparation checklist:
// - Create in-memory documents that mimic typical async blocks with awaits.
// - Cover const and let declarations to ensure variable kind preservation.
// - Validate rejection paths when selection includes non-await statements or complex patterns.
// - Ensure planned edit preserves indentation and replaces the correct range.
// - Confirm await keywords are stripped inside Promise.all entries.

suite("ParallelAwaitService", () => {
  const service = new ParallelAwaitService();

  test("should collapse sequential await const declarations into Promise.all", async () => {
    const content = [
      "async function loadData() {",
      "    const first = await fetchFirst();",
      "    const second = await fetchSecond();",
      "}",
      ""
    ].join("\n");
    const document = await createDocument(content);
    const selection = selectLines(document, 1, 2);

    const result = service.createPlan(document, selection);
    assert.ok(result.success, "Expected plan to succeed for const awaits");

    const plan = result as ParallelAwaitPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "async function loadData() {",
        "    const [first, second] = await Promise.all([",
        "        fetchFirst(),",
        "        fetchSecond()",
        "    ]);",
        "}",
        ""
      ].join("\n")
    );
  });

  test("should use let destructuring when inputs are let awaits", async () => {
    const content = [
      "async function loadMutable() {",
      "    let first = await fetchFirst();",
      "    let second = await fetchSecond();",
      "    first += 1;",
      "    return first + second;",
      "}",
      ""
    ].join("\n");
    const document = await createDocument(content);
    const selection = selectLines(document, 1, 2);

    const result = service.createPlan(document, selection);
    assert.ok(result.success, "Expected plan to succeed for let awaits");

    const plan = result as ParallelAwaitPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "async function loadMutable() {",
        "    let [first, second] = await Promise.all([",
        "        fetchFirst(),",
        "        fetchSecond()",
        "    ]);",
        "    first += 1;",
        "    return first + second;",
        "}",
        ""
      ].join("\n")
    );
  });

  test("should report unsupported when selection mixes await and non-await statements", async () => {
    const content = [
      "async function loadData() {",
      "    const first = await fetchFirst();",
      "    const second = getSecond();",
      "}",
      ""
    ].join("\n");
    const document = await createDocument(content);
    const selection = selectLines(document, 1, 2);

    const result = service.createPlan(document, selection);

    assert.strictEqual(result.success, false, "Expected plan to fail for mixed awaits");
    if (!result.success) {
      assert.strictEqual(result.reason, "unsupported");
    }
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: "typescript", content });
}

function selectLines(document: vscode.TextDocument, startLine: number, endLine: number): vscode.Selection {
  const start = document.lineAt(startLine).range.start;
  const end = document.lineAt(endLine).range.end;
  return new vscode.Selection(start, end);
}

function applyPlan(document: vscode.TextDocument, plan: ParallelAwaitPlanSuccess["plan"]): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Tests cover const and let conversions plus unsupported mixed statements.
// Future enhancements: Handle object/array bindings, retain comments, and support await expressions inside expressions.
// Validation: Fully automated via vscode in-memory documents; no manual steps required.