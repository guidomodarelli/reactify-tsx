import * as assert from 'assert';
import * as vscode from 'vscode';
import { IfElseFlipService, FlipPlanFailure } from '../services/ifElseFlipService';

suite('IfElseFlipService', () => {
  const service = new IfElseFlipService();

  test('flips simple comparison-based if/else', async () => {
    const content = "if (value > 0) {\n    handlePositive();\n} else {\n    handleNonPositive();\n}";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (value > 0)');

    const result = service.createFlipPlan(document, selection);
    assert.ok(result.success, 'Expected flip plan to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      "if (value <= 0) {\n    handleNonPositive();\n} else {\n    handlePositive();\n}"
    );
  });

  test('applies De Morgan when negating logical and', async () => {
    const content = "if (isReady && hasData) {\n    run();\n} else {\n    fallback();\n}";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (isReady && hasData)');

    const result = service.createFlipPlan(document, selection);
    assert.ok(result.success, 'Expected flip plan to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      "if (!isReady || !hasData) {\n    fallback();\n} else {\n    run();\n}"
    );
  });

  test('removes double negation', async () => {
    const content = "if (!ready) {\n    wait();\n} else {\n    proceed();\n}";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (!ready)');

    const result = service.createFlipPlan(document, selection);
    assert.ok(result.success, 'Expected flip plan to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      "if (ready) {\n    proceed();\n} else {\n    wait();\n}"
    );
  });

  test('flips ternary expression', async () => {
    const content = "const result = value > 0 ? 'positive' : 'nonPositive';";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "value > 0 ? 'positive' : 'nonPositive'");

    const result = service.createFlipPlan(document, selection);
    assert.ok(result.success, 'Expected flip plan to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      "const result = value <= 0 ? 'nonPositive' : 'positive';"
    );
  });

  test('fails when else branch is missing', async () => {
    const content = "if (value > 0) {\n    handlePositive();\n}";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (value > 0)');

    const result = service.createFlipPlan(document, selection);
    assert.ok(!result.success, 'Expected flip plan to fail');
    const failure = result as FlipPlanFailure;
    assert.strictEqual(failure.reason, 'no-else');
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: 'typescript', content });
}

function selectSubstring(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, 'Substring not found: ' + target);
  const start = document.positionAt(index);
  const end = document.positionAt(index + target.length);
  return new vscode.Selection(start, end);
}

function applyPlan(document: vscode.TextDocument, plan: { range: vscode.Range; newText: string }): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}
