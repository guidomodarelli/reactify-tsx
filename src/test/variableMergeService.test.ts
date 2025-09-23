import * as assert from 'assert';
import * as vscode from 'vscode';
import { VariableMergeService } from '../services/variableMergeService';

// Preparation checklist:
// - Identify simple declaration-followed-by-assignment patterns for let/var.
// - Ensure only single-identifier declarators are merged; guard others.
// - Verify adjacency: assignment must be the immediate next statement in scope.
// - Preserve indentation and replace both statements atomically.
// - Keep tests isolated with in-memory VS Code documents; assert final text.

suite('VariableMergeService', () => {
  const service = new VariableMergeService();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should merge declaration and initialization into one statement (let)', async () => {
    const content = ['let value;', 'value = compute();', 'use(value);', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let value');

    const planResult = service.createMergeDeclarationAndInitializationPlan(document, selection);
    assert.ok(planResult.success, 'Expected merge plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(
      updated,
      ['let value = compute();', 'use(value);', ''].join('\n'),
    );
  });

  test('should merge declaration and initialization into one statement (var)', async () => {
    const content = ['var x;', 'x = 1;', 'x++;', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'var x;');

    const planResult = service.createMergeDeclarationAndInitializationPlan(document, selection);
    assert.ok(planResult.success, 'Expected merge plan to succeed');

    const updated = applyPlan(document, planResult.plan);
    assert.strictEqual(
      updated,
      ['var x = 1;', 'x++;', ''].join('\n'),
    );
  });

  test('should fail merge when assignment targets a different identifier', async () => {
    const content = ['let a;', 'b = 1;', ''].join('\n');
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'let a;');

    const planResult = service.createMergeDeclarationAndInitializationPlan(document, selection);
    assert.strictEqual(planResult.success, false, 'Expected merge plan to fail for mismatched identifier');
  });

  test('should fail when selection does not cover declaration or assignment pair', async () => {
    const content = 'console.log(42);\n';
    const document = await createTsDocument(content);
    const selection = selectSubstring(document, 'console.log');

    const planResult = service.createMergeDeclarationAndInitializationPlan(document, selection);
    assert.strictEqual(planResult.success, false, 'Expected merge plan to fail without matching pattern');
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

// Coverage commentary: Validates happy-path merges for let/var and rejects mismatched identifiers
// or non-adjacent non-matching statements. Future enhancements: handle destructuring and comments
// preservation spanning the two statements.

// Validation: Tests are self-contained, deterministic, and use in-memory documents only.
// No manual steps required.

