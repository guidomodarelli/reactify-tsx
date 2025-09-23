import * as assert from 'assert';
import * as vscode from 'vscode';
import { VariableKindConversionService } from '../services/variableKindConversionService';

// Preparation checklist:
// - Identify supported selection contexts (variable statement under caret).
// - Cover conversions: var|const -> let and var|let -> const.
// - Enforce safety for const: initializer required, no later writes.
// - Exercise unsupported cases (missing initializer, reassignment detected).
// - Keep tests isolated using in-memory documents.

suite('VariableKindConversionService', () => {
  const service = new VariableKindConversionService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should convert var to let', async () => {
    const content = 'var count = 1;\nconsole.log(count);\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'var count');

    const planResult = service.createConversionPlan(document, selection, 'let');
    assert.ok(planResult.success, 'Expected conversion plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(updated, 'let count = 1;\nconsole.log(count);\n');
  });

  test('should convert const to let', async () => {
    const content = 'const name = "a";\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'const name');

    const planResult = service.createConversionPlan(document, selection, 'let');
    assert.ok(planResult.success, 'Expected conversion plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(updated, 'let name = "a";\n');
  });

  test('should convert let to const when safe (no writes, has initializer)', async () => {
    const content = 'let value = compute();\nuse(value);\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let value');

    const planResult = service.createConversionPlan(document, selection, 'const');
    assert.ok(planResult.success, 'Expected conversion plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(updated, 'const value = compute();\nuse(value);\n');
  });

  test('should fail converting to const when variable is reassigned', async () => {
    const content = [
      'let total = 1 + 2;',
      'total = 5;',
    ].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let total');

    const planResult = service.createConversionPlan(document, selection, 'const');
    assert.strictEqual(planResult.success, false, 'Expected conversion plan to fail due to reassignment');
  });

  test('should fail converting to const when initializer is missing', async () => {
    const content = 'let later;\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let later');

    const planResult = service.createConversionPlan(document, selection, 'const');
    assert.strictEqual(planResult.success, false, 'Expected conversion plan to fail without initializer');
  });
});

async function createTsDocument(content: string): Promise<vscode.TextDocument> {
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

function applyPlan(
  document: vscode.TextDocument,
  plan: { range: vscode.Range; newText: string },
): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Validates kind changes to let from var/const and safe upgrades to const, plus
// failure paths for reassignments and missing initializers. Future work: support destructuring declarations
// and multi-declarator lists with granular safety analysis by scope and control flow.

// Validation: Tests are independent, use in-memory VS Code documents, and assert exact updated text outputs.
// No manual steps required.

