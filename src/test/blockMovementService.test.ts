import * as assert from 'assert';
import * as vscode from 'vscode';
import { BlockMovementService, MoveBlockDirection, MovePlanFailure } from '../services/blockMovementService';

/**
 * Test design checklist:
 * 1. Validate block identification for typical compound statements (if, loops, functions).
 * 2. Confirm movement swaps preserve formatting and remain inside the parent scope.
 * 3. Ensure attempts at boundary crossings produce informative failures.
 * 4. Confirm collapsed selections on leading indentation still resolve the intended statement.
 * 5. Ensure class members and similar nested constructs can be reordered without moving their parent declarations.
 * 6. Preserve leading comments or annotations when the owning statement moves.
 * 7. Support reversed selection ranges so users dragging bottom-to-top still trigger movement.
 */

suite('BlockMovementService', () => {
  const service = new BlockMovementService();

  test('moves if/else block upward within the same function scope', async () => {
    const content = [
      'function demo() {',
      '    const before = 1;',
      '',
      '    if (value > 0) {',
      '        handlePositive();',
      '    } else {',
      '        handleNonPositive();',
      '    }',
      '',
      '    const after = 2;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'if (value > 0)');

    const result = service.createMovePlan(document, selection, direction('up'));
    assert.ok(result.success, 'Expected block movement plan to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'function demo() {',
        '    if (value > 0) {',
        '        handlePositive();',
        '    } else {',
        '        handleNonPositive();',
        '    }',
        '',
        '    const before = 1;',
        '',
        '    const after = 2;',
        '}',
      ].join('\n'),
    );
  });

  test('allows moving block when cursor rests at leading indentation before statement keyword', async () => {
    const content = [
      'function sample() {',
      '    const before = 0;',
      '',
      '    if (flag) {',
      '        execute();',
      '    }',
      '',
      '    const after = 1;',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = placeCursorAt(document, '    if (flag) {');

    const result = service.createMovePlan(document, selection, direction('up'));
    assert.ok(
      result.success,
      'Expected block movement to account for indentation-only cursor positions',
    );

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'function sample() {',
        '    if (flag) {',
        '        execute();',
        '    }',
        '',
        '    const before = 0;',
        '',
        '    const after = 1;',
        '}',
      ].join('\n'),
    );
  });

  test('moves function declaration downward without leaving the module scope', async () => {
    const content = [
      'function first() {',
      '    performFirst();',
      '}',
      '',
      'function second() {',
      '    performSecond();',
      '}',
      '',
      'const tailMarker = true;',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'function first() {');

    const result = service.createMovePlan(document, selection, direction('down'));
    assert.ok(result.success, 'Expected movement plan to succeed for function declaration');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'function second() {',
        '    performSecond();',
        '}',
        '',
        'function first() {',
        '    performFirst();',
        '}',
        '',
        'const tailMarker = true;',
      ].join('\n'),
    );
  });

  test('moves class method downward while keeping the class declaration in place', async () => {
    const content = [
      'class Example {',
      '    public first(): void {',
      '        firstAction();',
      '    }',
      '',
      '    public second(): void {',
      '        secondAction();',
      '    }',
      '}',
      '',
      'const tail = true;',
    ].join('\n');

    const document = await createDocument(content);
    const selection = placeCursorAt(document, '    public first(): void {');

    const result = service.createMovePlan(document, selection, direction('down'));
    assert.ok(result.success, 'Expected movement plan to target the class method');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'class Example {',
        '    public second(): void {',
        '        secondAction();',
        '    }',
        '',
        '    public first(): void {',
        '        firstAction();',
        '    }',
        '}',
        '',
        'const tail = true;',
      ].join('\n'),
    );
  });

  test('moves class property upward when cursor rests on the declaration line', async () => {
    const content = [
      'const beforeMarker = 0;',
      '',
      'class Config {',
      "    public readonly label = 'alpha';",
      "    public readonly order = 1;",
      '',
      '    public describe(): string {',
      "        return `${this.label}-${this.order}`;",
      '    }',
      '}',
      '',
      'function after(): void {',
      "    console.log('done');",
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = placeCursorAt(document, "    public readonly order = 1;");

    const result = service.createMovePlan(document, selection, direction('up'));
    assert.ok(result.success, 'Expected the property to move within the class body');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'const beforeMarker = 0;',
        '',
        'class Config {',
        "    public readonly order = 1;",
        "    public readonly label = 'alpha';",
        '',
        '    public describe(): string {',
        "        return `${this.label}-${this.order}`;",
        '    }',
        '}',
        '',
        'function after(): void {',
        "    console.log('done');",
        '}',
      ].join('\n'),
    );
  });

  test('keeps leading line comment attached when moving statement downward', async () => {
    const content = [
      'const alpha = computeAlpha();',
      '// This comment describes beta',
      'const beta = computeBeta();',
      'const gamma = computeGamma();',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'const beta = computeBeta();');

    const result = service.createMovePlan(document, selection, direction('down'));
    assert.ok(result.success, 'Expected comment-carrying statement to move successfully');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'const alpha = computeAlpha();',
        'const gamma = computeGamma();',
        '// This comment describes beta',
        'const beta = computeBeta();',
      ].join('\n'),
    );
  });

  test('supports reversed selection offsets when moving block upward', async () => {
    const content = [
      'const first = 1;',
      'const second = 2;',
      'const third = 3;',
    ].join('\n');

    const document = await createDocument(content);
    const targetText = 'const second = 2;';
    const fullText = document.getText();
    const startIndex = fullText.indexOf(targetText);
    assert.ok(startIndex >= 0, 'Expected to locate reversed selection target');
    const selection = new vscode.Selection(
      document.positionAt(startIndex + targetText.length),
      document.positionAt(startIndex),
    );

    const result = service.createMovePlan(document, selection, direction('up'));
    assert.ok(result.success, 'Expected reversed selection to be normalized for movement');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'const second = 2;',
        'const first = 1;',
        'const third = 3;',
      ].join('\n'),
    );
  });

  test('prevents moving past the top boundary of the containing block', async () => {
    const content = [
      'function demo() {',
      '    while (shouldContinue()) {',
      '        iterate();',
      '    }',
      '',
      '    finalize();',
      '}',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'while (shouldContinue())');

    const result = service.createMovePlan(document, selection, direction('up'));
    assert.ok(!result.success, 'Expected block movement to fail at boundary');
    const failure = result as MovePlanFailure;
    assert.strictEqual(failure.reason, 'at-boundary');
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

function placeCursorAt(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, 'Cursor anchor not found: ' + target);
  const position = document.positionAt(index);
  return new vscode.Selection(position, position);
}

function applyPlan(
  document: vscode.TextDocument,
  plan: { range: vscode.Range; newText: string },
): string {
  const original = document.getText();
  const start = document.offsetAt(plan.range.start);
  const end = document.offsetAt(plan.range.end);
  return original.slice(0, start) + plan.newText + original.slice(end);
}

function direction(value: MoveBlockDirection): MoveBlockDirection {
  return value;
}

/*
Coverage commentary: These tests validate upward and downward swaps for representative blocks (if/else, function declarations), exercise class member reordering, ensure scope boundaries stop movement, cover indentation-only cursor placements, preserve leading comments alongside their statements, and normalize reversed selection offsets. Future enhancements could cover namespace or module member ordering and multiline comment clusters shared across sibling statements.
*/

// Validation: Tests rely on VS Code in-memory documents and deterministic text swapping, exercising the BlockMovementService contract without external IO.
