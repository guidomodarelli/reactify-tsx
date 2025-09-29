import * as assert from 'assert';
import * as vscode from 'vscode';
import { NestedIfMergeService, type MergePlanSuccess } from '../services/nestedIfMergeService';

/**
 * Preparation checklist:
 * - Identify an outer if-statement under the selection with no else branch.
 * - Detect a direct inner if-statement within the then-branch, also with no else.
 * - Build a merged guard using logical AND with minimal, safe parentheses.
 * - Preserve inner then-branch body while replacing the outer if range.
 * - Support TS/JS and TSX/JSX via appropriate ScriptKind resolution.
 */

suite('NestedIfMergeService', () => {
  const service = new NestedIfMergeService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should merge simple nested blocks into a single if with &&', async () => {
    const content = [
      'function f(a: boolean, b: boolean) {',
      '  if (a) {',
      '    if (b) {',
      '      doIt();',
      '    }',
      '  }',
      '}',
    ].join('\n');

    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createMergePlan(document, selection);
    assert.ok(plan.success, 'Expected merge plan for simple nested if');

    const updated = applyPlan(document, (plan as MergePlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'function f(a: boolean, b: boolean) {',
        '  if (a && b) {',
        '    doIt();',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  test('should merge nested ifs even when inner then is a single statement', async () => {
    const content = [
      'if (enabled) {',
      '  if (ready)',
      '    run();',
      '}',
    ].join('\n');

    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'if (enabled)');

    const plan = service.createMergePlan(document, selection);
    assert.ok(plan.success, 'Expected merge plan for non-block inner statement');

    const updated = applyPlan(document, (plan as MergePlanSuccess).plan);
    assert.strictEqual(
      updated,
      ['if (enabled && ready)', '    run();'].join('\n'),
    );
  });

  test('should preserve necessary parentheses when inner condition is an OR', async () => {
    const content = [
      'function f(a: boolean, b: boolean, c: boolean) {',
      '  if (a) {',
      '    if (b || c) {',
      '      x();',
      '    }',
      '  }',
      '}',
    ].join('\n');

    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createMergePlan(document, selection);
    assert.ok(plan.success, 'Expected merge plan with parenthesized inner OR');

    const updated = applyPlan(document, (plan as MergePlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'function f(a: boolean, b: boolean, c: boolean) {',
        '  if (a && (b || c)) {',
        '    x();',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  test('should be available inside TSX and normalize self-closing tags', async () => {
    const content = [
      'const Comp = () => {',
      '  if (show) {',
      '    if (visible) {',
      '      return <div/>;',
      '    }',
      '  }',
      '  return null;',
      '};',
    ].join('\n');

    const document = await createDocument('typescriptreact', content);
    const selection = selectSubstring(document, 'if (show)');

    const plan = service.createMergePlan(document, selection);
    assert.ok(plan.success, 'Expected merge plan within TSX function body');

    const updated = applyPlan(document, (plan as MergePlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'const Comp = () => {',
        '  if (show && visible) {',
        '    return <div />;',
        '  }',
        '  return null;',
        '};',
      ].join('\n'),
    );
  });

  test('should fail when outer if has an else branch', async () => {
    const content = [
      'if (a) {',
      '  if (b) { run(); }',
      '} else {',
      '  other();',
      '}',
    ].join('\n');

    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createMergePlan(document, selection);
    assert.strictEqual(plan.success, false, 'Expected failure when outer has else');
    if (!plan.success) {
      assert.strictEqual(plan.reason, 'unsupported');
    }
  });

  test('should fail when inner if has an else branch', async () => {
    const content = [
      'if (a) {',
      '  if (b) { run(); } else { stop(); }',
      '}',
    ].join('\n');

    const document = await createDocument('typescript', content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createMergePlan(document, selection);
    assert.strictEqual(plan.success, false, 'Expected failure when inner has else');
    if (!plan.success) {
      assert.strictEqual(plan.reason, 'unsupported');
    }
  });
});

async function createDocument(language: string, content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language, content });
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
  plan: MergePlanSuccess['plan'],
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

/**
 * Coverage commentary: Verifies merging for block and single-statement inner if, parentheses
 * preservation for disjunctions, TSX handling with self-closing spacing, and negative cases for
 * unsupported shapes (else branches). Validation: fully automated using in-memory documents.
 * Future enhancements: consider merging chains of nested ifs and preserving leading/trailing comments.
 */
