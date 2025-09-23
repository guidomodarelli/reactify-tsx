import * as assert from 'assert';
import * as vscode from 'vscode';
import { StringSplitMergeService, type StringSplitMergePlanSuccess } from '../services/stringSplitMergeService';

// Test design checklist:
// 1. Split at caret inside a single-quoted string into two concatenated literals.
// 2. Merge a chain of adjacent string literals connected by '+'.
// 3. Preserve quote style (single vs double).
// 4. Guard rails: do nothing when caret is at string boundaries; reject merge when non-literals are present.

suite('StringSplitMergeService', () => {
  const service = new StringSplitMergeService();

  test('should split single-quoted string at caret into two concatenated strings', async () => {
    const content = "const s = 'hello world';\n";
    const document = await createDocument(content);
    const selection = caretInside(document, "'hello world'", 6); // after 'hello '

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected split plan to succeed.');
    const plan = result as StringSplitMergePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'split');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, "const s = 'hello ' + 'world';\n");
  });

  test('should merge adjacent string literals connected by plus', async () => {
    const content = "const s = 'hello ' + 'world' + '!';\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "'hello ' + 'world' + '!'" );

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected merge plan to succeed.');
    const plan = result as StringSplitMergePlanSuccess;
    assert.strictEqual(plan.plan.mode, 'merge');

    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, "const s = 'hello world!';\n");
  });

  test('should preserve double quotes when splitting', async () => {
    const content = 'const t = "abcd";\n';
    const document = await createDocument(content);
    const selection = caretInside(document, '"abcd"', 2); // after "ab"

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected split plan to succeed for double quotes.');
    const plan = result as StringSplitMergePlanSuccess;
    const updated = applyPlan(document, plan.plan);
    assert.strictEqual(updated, 'const t = "ab" + "cd";\n');
  });

  test('should not split when caret is at start or end of the string content', async () => {
    const content = "const s = 'xy';\n";
    const document = await createDocument(content);
    // Caret at start of content
    const atStart = caretInside(document, "'xy'", 0);
    const startResult = service.createPlan(document, atStart);
    assert.strictEqual(startResult.success, false);
    // Caret at end of content
    const atEnd = caretInside(document, "'xy'", 2);
    const endResult = service.createPlan(document, atEnd);
    assert.strictEqual(endResult.success, false);
  });

  test('should not merge when non-literal is present in the + chain', async () => {
    const content = "const name = 'Ada'; const s = 'Hello ' + name + '!';\n";
    const document = await createDocument(content);
    const selection = selectSubstring(document, "'Hello ' + name + '!'" );

    const result = service.createPlan(document, selection);
    assert.strictEqual(result.success, false);
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

function caretInside(document: vscode.TextDocument, containing: string, contentOffset: number): vscode.Selection {
  // Positions the caret inside the inner content of the containing literal at the given content offset.
  const fullText = document.getText();
  const containerIndex = fullText.indexOf(containing);
  assert.ok(containerIndex >= 0, `Container not found: ${containing}`);
  // Add 1 to get past the opening quote character.
  const caretDocOffset = containerIndex + 1 + contentOffset;
  const pos = document.positionAt(caretDocOffset);
  return new vscode.Selection(pos, pos);
}

function applyPlan(document: vscode.TextDocument, plan: StringSplitMergePlanSuccess['plan']): string {
  const startOffset = document.offsetAt(plan.range.start);
  const endOffset = document.offsetAt(plan.range.end);
  const content = document.getText();
  return `${content.slice(0, startOffset)}${plan.newText}${content.slice(endOffset)}`;
}

// Coverage commentary: Covers split and merge modes, quote preservation, and key guard rails.
// Future enhancements: Support template literals and escaped characters; allow splitting across multiple carets.

// Validation: Tests are independent, deterministic, and run against in-memory TextDocuments with no external IO.

