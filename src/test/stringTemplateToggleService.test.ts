import * as assert from 'assert';
import * as vscode from 'vscode';
import { StringTemplateToggleService, type StringTemplateTogglePlanSuccess } from '../services/stringTemplateToggleService';

// Test design checklist:
// 1. String → Template: converts single/double quoted strings to backtick templates with equivalent content.
// 2. Template → String: converts no-substitution template literals to single-quoted strings with proper escaping.
// 3. Unsupported: template literals containing expressions should be reported as unsupported.

suite('StringTemplateToggleService', () => {
  const service = new StringTemplateToggleService();

  test('should convert regular string literal to no-substitution template literal', async () => {
    const content = "const a = 'hello world';\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "'hello world'");

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for string → template.');

    const plan = result as StringTemplateTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'to-template');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, 'const a = `hello world`;\n');
  });

  test('should convert simple template literal to single-quoted string literal', async () => {
    const content = 'const b = `line1`;\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '`line1`');

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for template → string.');

    const plan = result as StringTemplateTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'to-string');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, "const b = 'line1';\n");
  });

  test('should report unsupported when template contains expressions', async () => {
    const content = 'const c = `hi ${name}`;\n';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '`hi ${name}`');

    const result = service.createTogglePlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected toggle to fail for template expressions.');
    if (result.success) {
      assert.fail('Expected unsupported reason, but received success.');
    } else {
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

function applyPlan(document: vscode.TextDocument, plan: StringTemplateTogglePlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Exercises both toggle directions and guards against templates with expressions.
// Future enhancements: support preserving original quote style and safely handling multiline content.

// Validation: Automated tests verify successful toggles and correct unsupported handling. No manual steps required.

