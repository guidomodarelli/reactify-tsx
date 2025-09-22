import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsxAttributeValueToggleService, type AttributeTogglePlanSuccess } from '../services/jsxAttributeValueToggleService';

// Test design checklist:
// 1. Toggle wraps: ensure string literal attributes acquire braces with identical content.
// 2. Toggle unwraps: ensure string literals inside braces revert to bare literal syntax.
// 3. Unsupported cases: ensure non-string expressions do not produce toggle plans.

suite('JsxAttributeValueToggleService', () => {
  const service = new JsxAttributeValueToggleService();

  test('should wrap string literal initializer with braces when toggling', async () => {
    const content = "const element = <Button label=\"primary\" />;\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'label="primary"');

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for wrapping.');

    const plan = result as AttributeTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'wrap');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, "const element = <Button label={\"primary\"} />;\n");
  });

  test('should unwrap string literal expression back to bare literal', async () => {
    const content = "const element = <Button label={'primary'} />;\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "label={'primary'}");

    const result = service.createTogglePlan(document, selection);
    assert.ok(result.success, 'Expected toggle plan to succeed for unwrapping.');

    const plan = result as AttributeTogglePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'unwrap');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, "const element = <Button label='primary' />;\n");
  });

  test('should report unsupported when JSX expression is not a string literal', async () => {
    const content = "const element = <Button label={primaryLabel} />;\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "label={primaryLabel}");

    const result = service.createTogglePlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected toggle to fail for non-string expression.');
    if (result.success) {
      assert.fail('Expected unsupported reason, but received success.');
    } else {
      assert.strictEqual(result.reason, 'unsupported');
    }
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: 'typescriptreact', content });
}

function selectSubstring(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `Substring not found: ${target}`);
  const start = document.positionAt(index);
  const end = document.positionAt(index + target.length);
  return new vscode.Selection(start, end);
}

function applyPlan(document: vscode.TextDocument, plan: AttributeTogglePlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Validates wrapping and unwrapping flows for string literals and defends against unsupported expressions.
// Future enhancements: add coverage for template literals and enforce caret-only selections that rely on implicit attribute detection.

// Validation: Automated tests exercise both toggle directions and confirm unsupported cases are handled gracefully. No manual steps required.
