import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConditionalSimplifyService, SimplifyConditionalPlanSuccess } from '../services/conditionalSimplifyService';

/**
 * Preparation checklist:
 * - Identify safe ternary simplifications (boolean literals, identical branches).
 * - Parse with TSX-friendly script kind to support JSX arms.
 * - Replace only the selected conditional expression.
 * - Keep parentheses/JSX spacing correct when printing.
 * - Validate happy paths and a representative unsupported case.
 */

suite('ConditionalSimplifyService', () => {
  const service = new ConditionalSimplifyService();

  test('simplifies `cond ? true : false` to `!!cond` inside return', async () => {
    const content = [
      'function f(cond: unknown) {',
      '  return cond ? true : false;',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'cond ? true : false');

    const result = service.createSimplifyPlan(document, selection);
    assert.ok(result.success, 'Expected ternary simplification to succeed');

    const updated = applyPlan(document, (result as SimplifyConditionalPlanSuccess).plan);
    assert.strictEqual(
      updated,
      ['function f(cond: unknown) {', '  return !!cond;', '}'].join('\n'),
    );
  });

  test('simplifies `cond ? false : true` to `!cond`', async () => {
    const content = [
      'const value = (cond: boolean) => cond ? false : true;',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'cond ? false : true');

    const result = service.createSimplifyPlan(document, selection);
    assert.ok(result.success, 'Expected ternary simplification to succeed');

    const updated = applyPlan(document, (result as SimplifyConditionalPlanSuccess).plan);
    assert.strictEqual(updated, 'const value = (cond: boolean) => !cond;');
  });

  test('simplifies identical branches to a single expression (supports JSX)', async () => {
    const content = [
      'const View = (c: boolean) => {',
      '  return c ? <Item/> : <Item/>;',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'c ? <Item/> : <Item/>');

    const result = service.createSimplifyPlan(document, selection);
    assert.ok(result.success, 'Expected identical-branches simplification');

    const updated = applyPlan(document, (result as SimplifyConditionalPlanSuccess).plan);
    assert.strictEqual(
      updated,
      ['const View = (c: boolean) => {', '  return <Item />;', '}'].join('\n'),
    );
  });

  test('does not simplify non-boolean literal numeric arms', async () => {
    const content = 'const x = cond ? 1 : 0;';
    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'cond ? 1 : 0');

    const result = service.createSimplifyPlan(document, selection);
    assert.strictEqual(result.success, false, 'Numeric branches must not be simplified');
    if (!result.success) {
      assert.strictEqual(result.reason, 'unsupported');
    }
  });
});

async function createDocument(languageId: 'typescript' | 'typescriptreact', content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: languageId, content });
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
  plan: SimplifyConditionalPlanSuccess['plan'],
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

/**
 * Coverage commentary: Validates boolean literal simplifications (true/false, false/true),
 * identical-branch collapsing (including JSX), and a guarded unsupported case. Printer preserves
 * JSX spacing via normalization and wraps complex negations with parentheses. Fully automated; no manual steps.
 */

