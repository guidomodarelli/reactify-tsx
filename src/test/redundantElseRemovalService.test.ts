import * as assert from 'assert';
import * as vscode from 'vscode';
import { RedundantElseRemovalService, type RedundantElseRemovalPlanSuccess } from '../services/redundantElseRemovalService';

/**
 * Preparation checklist:
 * - Identify if statements through the TypeScript AST that fully enclose the selection range.
 * - Model terminal statements (return/throw/break/continue) to confirm when an else branch is redundant.
 * - Ensure else contents are preserved verbatim with original formatting when hoisted.
 * - Guard unsupported constructs such as chained else-if branches or missing else blocks.
 * - Cover both positive transformations and negative result reasoning for clear diagnostics.
 */

suite('RedundantElseRemovalService', () => {
  const service = new RedundantElseRemovalService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should remove else branch when then block returns', async () => {
    const content = [
      'function render(value: number) {',
      '  if (value > 0) {',
      '    return "positive";',
      '  } else {',
      '    finalize();',
      '    return "nonPositive";',
      '  }',
      '}',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (value > 0)');

    const result = service.createRemovalPlan(document, selection);
    assert.ok(result.success, 'Expected redundant else removal to succeed for returning then branch');

    const applied = applyPlan(document, (result as RedundantElseRemovalPlanSuccess).plan);
    assert.strictEqual(
      applied,
      [
        'function render(value: number) {',
        '  if (value > 0) {',
        '    return "positive";',
        '  }',
        '',
        '  finalize();',
        '  return "nonPositive";',
        '}',
      ].join('\n'),
    );
  });

  test('should unwrap single statement else without braces', async () => {
    const content = [
      'function track(flag: boolean) {',
      '  if (flag) {',
      '    return;',
      '  } else log("miss");',
      '}',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (flag)');

    const result = service.createRemovalPlan(document, selection);
    assert.ok(result.success, 'Expected redundant else removal to unwrap single statement else');

    const applied = applyPlan(document, (result as RedundantElseRemovalPlanSuccess).plan);
    assert.strictEqual(
      applied,
      [
        'function track(flag: boolean) {',
        '  if (flag) {',
        '    return;',
        '  }',
        '',
        '  log("miss");',
        '}',
      ].join('\n'),
    );
  });

  test('should treat throw as terminal for redundancy analysis', async () => {
    const content = [
      'if (!props) {',
      '  throw new Error("Missing props");',
      '} else {',
      '  initialize();',
      '}',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (!props)');

    const result = service.createRemovalPlan(document, selection);
    assert.ok(result.success, 'Expected throw statement to qualify for redundant else removal');

    const applied = applyPlan(document, (result as RedundantElseRemovalPlanSuccess).plan);
    assert.strictEqual(
      applied,
      [
        'if (!props) {',
        '  throw new Error("Missing props");',
        '}',
        '',
        'initialize();',
      ].join('\n'),
    );
  });

  test('should fail when then branch does not terminate control flow', async () => {
    const content = [
      'if (ready) {',
      '  notify();',
      '} else {',
      '  fallback();',
      '}',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (ready)');

    const result = service.createRemovalPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected redundant else removal to fail when then branch continues');
    if (!result.success) {
      assert.strictEqual(result.reason, 'not-redundant');
    }
  });

  test('should fail when else branch is an else-if chain', async () => {
    const content = [
      'if (first) {',
      '  return 1;',
      '} else if (second) {',
      '  return 2;',
      '} else {',
      '  return 3;',
      '}',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (first)');

    const result = service.createRemovalPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected else-if chain to be unsupported');
    if (!result.success) {
      assert.strictEqual(result.reason, 'unsupported');
    }
  });

  test('should fail when no if statement is found in selection', async () => {
    const content = 'const value = 1;\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'value');

    const result = service.createRemovalPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected redundant else removal to fail without if statement');
    if (!result.success) {
      assert.strictEqual(result.reason, 'not-found');
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
  plan: RedundantElseRemovalPlanSuccess['plan'],
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

/**
 * Coverage commentary: Validates successful removal for block/single-line elses and terminal statements,
 * alongside failure paths for non-terminal blocks, else-if chains, and missing selections.
 * Future enhancements: Support removing redundant `else if` ladder heads and preserve trailing comments.
 * Validation: Fully automated via in-memory documents; no manual steps required.
 */
