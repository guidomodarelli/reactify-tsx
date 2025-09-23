import * as assert from 'assert';
import * as vscode from 'vscode';
import { ArrowParameterParensService, type ArrowParameterParensPlanSuccess } from '../services/arrowParameterParensService';

// Preparation checklist:
// - Locate arrow function fully covering current selection.
// - Detect single identifier parameter without existing parentheses.
// - Replace only the parameter slice, leaving body and spacing unchanged.
// - Guard cases: already parenthesized, multiple params, non-identifier pattern.
// - Keep tests deterministic via in-memory documents.

suite('ArrowParameterParensService', () => {
  const service = new ArrowParameterParensService();

  test('should add parens when single identifier param lacks them', async () => {
    const content = 'const inc = x => x + 1\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'x => x + 1');

    const result = service.createAddParensPlan(document, selection);
    assert.ok(result.success, 'Expected add-parens plan to succeed');

    const plan = result as ArrowParameterParensPlanSuccess;
    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, 'const inc = (x) => x + 1\n');
  });

  test('should report already-parenthesized when parameter already has parens', async () => {
    const content = 'const inc = (x) => x + 1\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '(x) => x + 1');

    const result = service.createAddParensPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected plan to fail for already-parenthesized');
    if (!result.success) {
      assert.strictEqual(result.reason, 'already-parenthesized');
    }
  });

  test('should report unsupported for multiple parameters', async () => {
    const content = 'const sum = (a, b) => a + b\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '(a, b) => a + b');

    const result = service.createAddParensPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected plan to fail for multiple params');
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

function applyPlan(document: vscode.TextDocument, plan: ArrowParameterParensPlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Tests cover happy path (add parens), already-parenthesized, and unsupported multi-param case.
// Future enhancements: handle comments around parameter, and spacing normalization.
// Validation: Fully automated; no external dependencies or manual steps required.

