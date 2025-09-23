import * as assert from 'assert';
import * as vscode from 'vscode';
import { VariableSplitService } from '../services/variableSplitService';

// Preparation checklist:
// - Identify selection contexts that map to variable statements or a single declarator.
// - Cover splitting multi-declarator lists into multiple statements (var/let/const).
// - Cover splitting declaration and initialization into two statements (let/var only).
// - Exercise unsupported paths: single-declarator for multi-split, const for decl-init split, and no selection.
// - Keep tests isolated with in-memory documents; assert exact resulting text.

suite('VariableSplitService', () => {
  const service = new VariableSplitService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should split multiple declarators into multiple statements (let)', async () => {
    const content = ['let a = 1, b = 2;', 'use(a, b);', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let a');

    const planResult = service.createSplitMultiplePlan(document, selection);
    assert.ok(planResult.success, 'Expected split plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(
      updated,
      ['let a = 1;', 'let b = 2;', 'use(a, b);', ''].join('\n'),
    );
  });

  test('should split multiple declarators into multiple statements (const)', async () => {
    const content = ['const x = 1, y = 2;', 'call(x, y);', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'const x');

    const planResult = service.createSplitMultiplePlan(document, selection);
    assert.ok(planResult.success, 'Expected split plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(
      updated,
      ['const x = 1;', 'const y = 2;', 'call(x, y);', ''].join('\n'),
    );
  });

  test('should fail to split multiple when only one declarator is present', async () => {
    const content = 'let only = 1;\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let only');

    const planResult = service.createSplitMultiplePlan(document, selection);
    assert.strictEqual(planResult.success, false, 'Expected plan to fail for single-declarator list');
  });

  test('should split declaration and initialization into two statements (let)', async () => {
    const content = ['let value = compute();', 'use(value);', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let value');

    const planResult = service.createSplitDeclarationAndInitializationPlan(document, selection);
    assert.ok(planResult.success, 'Expected decl/init split to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(
      updated,
      ['let value;', 'value = compute();', 'use(value);', ''].join('\n'),
    );
  });

  test('should fail decl/init split for const declaration', async () => {
    const content = 'const n = 1;\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'const n');

    const planResult = service.createSplitDeclarationAndInitializationPlan(document, selection);
    assert.strictEqual(planResult.success, false, 'Expected plan to fail for const decl/init split');
  });

  test('should fail when selection does not cover a variable statement', async () => {
    const content = 'console.log(42);\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'console.log');

    const planResultA = service.createSplitMultiplePlan(document, selection);
    const planResultB = service.createSplitDeclarationAndInitializationPlan(document, selection);
    assert.strictEqual(planResultA.success, false, 'Expected multi split to fail without variable');
    assert.strictEqual(planResultB.success, false, 'Expected decl/init split to fail without variable');
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

// Coverage commentary: Exercises happy paths for both split kinds (multi-declarator, decl/init),
// plus unsupported scenarios to ensure safe gating. Future enhancements: support object/array
// destructuring and preservation of leading comments and formatting nuances.

// Validation: Tests are self-contained, deterministic, and rely solely on in-memory VS Code docs.
// No manual steps required.

