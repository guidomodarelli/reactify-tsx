import * as assert from 'assert';
import * as vscode from 'vscode';
import { IfElseSimplifyService, type SimplifyPlanSuccess } from '../services/ifElseSimplifyService';

/**
 * Preparation checklist:
 * - Locate the enclosing if-statement within the given selection.
 * - Require presence of an else branch and reject else-if chains.
 * - Support boolean-return and boolean-assignment branches only.
 * - Collapse to direct condition or its negation (no ternary generation).
 * - Preserve minimal, idiomatic parentheses for negations.
 */

suite('IfElseSimplifyService', () => {
  const service = new IfElseSimplifyService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should simplify return true/false to return condition', async () => {
    const content = [
      'function f(flag: boolean) {',
      '  if (flag) {',
      '    return true;',
      '  } else {',
      '    return false;',
      '  }',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (flag)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.ok(plan.success, 'Expected simplification for boolean returns');

    const updated = applyPlan(document, (plan as SimplifyPlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'function f(flag: boolean) {',
        '  return flag;',
        '}',
      ].join('\n'),
    );
  });

  test('should simplify return false/true to return !condition', async () => {
    const content = [
      'function f(flag: boolean) {',
      '  if (flag) {',
      '    return false;',
      '  } else {',
      '    return true;',
      '  }',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (flag)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.ok(plan.success, 'Expected simplification to negated boolean return');

    const updated = applyPlan(document, (plan as SimplifyPlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'function f(flag: boolean) {',
        '  return !flag;',
        '}',
      ].join('\n'),
    );
  });

  test('should simplify boolean assignments to direct assignment', async () => {
    const content = [
      'let active = false;',
      'if (ready) {',
      '  active = true;',
      '} else {',
      '  active = false;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (ready)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.ok(plan.success, 'Expected assignment simplification');

    const updated = applyPlan(document, (plan as SimplifyPlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'let active = false;',
        'active = ready;',
      ].join('\n'),
    );
  });

  test('should simplify reversed boolean assignments to negated assignment', async () => {
    const content = [
      'let active = false;',
      'if (ready) {',
      '  active = false;',
      '} else {',
      '  active = true;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (ready)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.ok(plan.success, 'Expected negated assignment simplification');

    const updated = applyPlan(document, (plan as SimplifyPlanSuccess).plan);
    assert.strictEqual(
      updated,
      [
        'let active = false;',
        'active = !ready;',
      ].join('\n'),
    );
  });

  test('should fail for else-if chains', async () => {
    const content = [
      'if (a) {',
      '  return true;',
      '} else if (b) {',
      '  return false;',
      '} else {',
      '  return true;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (a)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.strictEqual(plan.success, false, 'Else-if should not be simplified');
    if (!plan.success) {
      assert.strictEqual(plan.reason, 'unsupported');
    }
  });

  test('should fail when else branch is missing', async () => {
    const content = [
      'if (cond) {',
      '  return true;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (cond)');

    const plan = service.createSimplifyPlan(document, selection);
    assert.strictEqual(plan.success, false, 'Missing else should fail simplification');
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
  plan: SimplifyPlanSuccess['plan'],
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

/**
 * Coverage commentary: Validates happy paths for boolean returns and assignments, negated variants,
 * and negative paths for else-if chains and missing else branches. Future enhancements: simplify identical
 * branch expressions and support parentheses-normalization for complex conditions. Validation: fully automated
 * via in-memory text documents; no manual steps required.
 */

