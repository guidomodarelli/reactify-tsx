import * as assert from 'assert';
import * as vscode from 'vscode';
import { ArrowBodyToggleService, type ArrowBodyTogglePlanSuccess } from '../services/arrowBodyToggleService';

// Preparation checklist:
// - Identify arrow function at selection boundaries.
// - Cover expression → block and block → expression toggles.
// - Guard unsupported cases (e.g., multi-statement blocks or missing returns).
// - Keep tests independent and deterministic using in-memory documents.
// - Validate full updated content for clarity.

suite('ArrowBodyToggleService', () => {
  const service = new ArrowBodyToggleService();

  test('should convert shorthand expression-bodied arrow to block with return', async () => {
    const content = 'const inc = (x: number) => x + 1\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'x + 1');

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for expression → block');

    const plan = result as ArrowBodyTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'to-block');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, 'const inc = (x: number) => {\n    return x + 1;\n}\n');
  });

  test('should convert block-bodied arrow with single return to shorthand expression', async () => {
    const content = 'const inc = (x: number) => { return x + 1; }\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '{ return x + 1; }');

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for block → expression');

    const plan = result as ArrowBodyTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'to-expression');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, 'const inc = (x: number) => x + 1\n');
  });

  test('should report unsupported for block with multiple statements', async () => {
    const content = 'const f = () => { const y = 1; return y; }\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '{ const y = 1; return y; }');

    const result = service.createTogglePlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected toggle to fail for multi-statement block');
    if (!result.success) {
      assert.strictEqual(result.reason, 'unsupported');
    }
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: 'typescript', content });
}

function selectSubstring(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `Substring not found: ${target}`);
  const start = document.positionAt(index);
  const end = document.positionAt(index + target.length);
  return new vscode.Selection(start, end);
}

function applyPlan(document: vscode.TextDocument, plan: ArrowBodyTogglePlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Tests cover both directions (expression ↔ block) and an unsupported case.
// Future enhancements: preserve and reposition comments within the body; support implicit `void` returns.
// Validation: Fully automated; no external dependencies or manual steps required.
