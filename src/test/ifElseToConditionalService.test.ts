import * as assert from 'assert';
import * as vscode from 'vscode';
import { IfElseToConditionalService, type ReplacePlanSuccess } from '../services/ifElseToConditionalService';

/**
 * Preparation checklist:
 * - Detect enclosing if-statement within selection and require an else branch.
 * - Support two patterns only: return/return and assignment/assignment with same target.
 * - Allow single statements or single-statement blocks in both branches.
 * - Preserve original expressions and JSX spacing when printing ternary.
 * - Provide clear failure reasons for unsupported constructs.
 */

suite('IfElseToConditionalService', () => {
  const service = new IfElseToConditionalService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should replace return-based if/else with conditional return', async () => {
    const content = [
      'function render(v: number) {',
      '  if (v > 0) {',
      '    return "positive";',
      '  } else {',
      '    return "nonPositive";',
      '  }',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (v > 0)');

    const plan = service.createReplacePlan(document, selection);
    assert.ok(plan.success, 'Expected conversion to succeed for return branches');

    const updated = applyPlan(document, (plan as ReplacePlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'function render(v: number) {',
        '  return v > 0 ? "positive" : "nonPositive";',
        '}',
      ].join('\n'),
    );
  });

  test('should replace assignment-based if/else with conditional assignment', async () => {
    const content = [
      'let label = "";',
      'if (ready) {',
      '  label = getPrimary();',
      '} else {',
      '  label = getFallback();',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (ready)');

    const plan = service.createReplacePlan(document, selection);
    assert.ok(plan.success, 'Expected conversion to succeed for assignments');

    const updated = applyPlan(document, (plan as ReplacePlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'let label = "";',
        'label = ready ? getPrimary() : getFallback();',
      ].join('\n'),
    );
  });

  test('should support single-statement branches without braces', async () => {
    const content = [
      'if (flag) return <A/>; else return <B/>;'
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (flag)');

    const plan = service.createReplacePlan(document, selection);
    assert.ok(plan.success, 'Expected conversion to handle single statements');

    const updated = applyPlan(document, (plan as ReplacePlanSuccess).plan);
    assert.strictEqual(updated, 'return flag ? <A /> : <B />;');
  });

  test('should fail for else-if chains', async () => {
    const content = [
      'if (a) {',
      '  return 1;',
      '} else if (b) {',
      '  return 2;',
      '} else {',
      '  return 3;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createReplacePlan(document, selection);
    assert.strictEqual(plan.success, false, 'Else-if chain not supported');
    if (!plan.success) {
      assert.strictEqual(plan.reason, 'unsupported');
    }
  });

  test('should fail when else branch is missing', async () => {
    const content = [
      'if (cond) {',
      '  return 1;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (cond)');

    const plan = service.createReplacePlan(document, selection);
    assert.strictEqual(plan.success, false, 'Missing else should fail conversion');
    if (!plan.success) {
      assert.strictEqual(plan.reason, 'no-else');
    }
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

function applyPlan(
  document: vscode.TextDocument,
  plan: ReplacePlanSuccess['plan'],
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

/**
 * Coverage commentary: Tests happy paths for return and assignment conversions, JSX spacing normalization,
 * and negative cases for unsupported else-if chains and missing else branches. Future enhancements: support
 * nested conditionals and preserve comments within branches if present. Validation: fully automated and
 * reproducible using in-memory VS Code documents.
 */

