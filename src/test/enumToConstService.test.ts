import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnumToConstService } from '../services/enumToConstService';
import type { EnumConversionPlanSuccess } from '../models/enumConversion';

// Test design checklist:
// 1. Cover exported string enums to verify primary happy path.
// 2. Cover non-exported enums with implicit numeric members to ensure incremental value handling.
// 3. Cover unsupported initializers to confirm graceful failure reporting.

suite('EnumToConstService', () => {
  const service = new EnumToConstService();

  test('should convert exported string enum to const object and type alias', async () => {
    const content = "export enum Status {\n  Active = 'active',\n  Inactive = 'inactive',\n}\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'export enum Status');

    const result = service.createConversionPlan(document, selection);
    assert.ok(result.success, 'Expected conversion to succeed');

    const plan = result as EnumConversionPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      "export const Status = {\n    Active: 'active',\n    Inactive: 'inactive'\n} as const;\n\nexport type Status = (typeof Status)[keyof typeof Status];\n\n",
    );
  });

  test('should compute implicit numeric members when converting', async () => {
    const content = "enum Palette {\n  Primary,\n  Secondary,\n}\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'enum Palette');

    const result = service.createConversionPlan(document, selection);
    assert.ok(result.success, 'Expected conversion to succeed');

    const plan = result as EnumConversionPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      "const Palette = {\n    Primary: 0,\n    Secondary: 1\n} as const;\n\ntype Palette = (typeof Palette)[keyof typeof Palette];\n\n",
    );
  });

  test('should fail when enum contains unsupported initializer', async () => {
    const content = "enum Unsupported {\n  Value = compute(),\n}\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'enum Unsupported');

    const result = service.createConversionPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected conversion to fail');
    if (result.success) {
      assert.fail('Expected failure for unsupported initializer');
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

function applyPlan(document: vscode.TextDocument, plan: EnumConversionPlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Exercises success paths for exported string enums and implicit numeric enums,
// plus failure handling for unsupported computed initializers. Future enhancements: evaluate support
// for const enums, ambient enums, and computed constant expressions beyond literals.

// Validation: Automated tests confirm conversion produces the expected const-object and type-alias
// structures, verifies numeric value derivation, and asserts error reporting for unsupported cases.
// No manual steps required.
