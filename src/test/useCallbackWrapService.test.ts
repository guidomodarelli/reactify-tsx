import * as assert from 'assert';
import * as vscode from 'vscode';
import { UseCallbackWrapService, type UseCallbackWrapPlanSuccess } from '../services/useCallbackWrapService';

// Preparation checklist:
// - Model arrow and function expression initializers inside variable declarations.
// - Capture scenarios for existing React named imports, default-only imports, and missing React imports.
// - Validate rejection paths for already wrapped callbacks and unrelated selections.
// - Keep helper utilities reusable and deterministic across assertions.
// - Assert final document snapshots to prove edits and import updates succeed.

suite('UseCallbackWrapService', () => {
  const service = new UseCallbackWrapService();

  test('should wrap arrow function initializer with useCallback and extend existing named import', async () => {
  test('should wrap when caret rests on variable name', async () => {
    const content = [
      "import { useState } from 'react';",
      '',
      'const handleClick = () => {',
      "    console.log('clicked');",
      '};',
      '',
    ].join('\n');
    const document = await createDocument(content);
    const selection = caretAt(document, 'handleClick = () =>');

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected wrap plan to succeed for caret on variable name');

    const plan = result as UseCallbackWrapPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "import { useState, useCallback } from 'react';",
        '',
        'const handleClick = useCallback(() => {',
        "    console.log('clicked');",
        '}, []);',
        '',
      ].join('\n'),
    );
  });

    const content = [
      "import { useState } from 'react';",
      '',
      'const handleClick = () => {',
      "    console.log('clicked');",
      '};',
      '',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, '= () => {');

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected wrap plan to succeed for arrow function initializer');

    const plan = result as UseCallbackWrapPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "import { useState, useCallback } from 'react';",
        '',
        'const handleClick = useCallback(() => {',
        "    console.log('clicked');",
        '}, []);',
        '',
      ].join('\n'),
    );
  });

  test('should add standalone React import when none exists', async () => {
    const content = [
      "import type { MouseEvent } from 'react-dom';",
      '',
      'const handleClick = function handleClick(event: MouseEvent) {',
      "    console.log('clicked', event.type);",
      '};',
      '',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, '= function handleClick');

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected wrap plan to succeed and synthesize new React import');

    const plan = result as UseCallbackWrapPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "import { useCallback } from 'react';",
        "import type { MouseEvent } from 'react-dom';",
        '',
        'const handleClick = useCallback(function handleClick(event: MouseEvent) {',
        "    console.log('clicked', event.type);",
        '}, []);',
        '',
      ].join('\n'),
    );
  });

  test('should upgrade default React import to include useCallback specifier', async () => {
    const content = [
      "import React from 'react';",
      '',
      'const handleClick = async () => {',
      "    await Promise.resolve('ok');",
      '};',
      '',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, '= async () =>');

    const result = service.createPlan(document, selection);
    assert.ok(result.success, 'Expected wrap plan to succeed for default React import');

    const plan = result as UseCallbackWrapPlanSuccess;
    const updated = applyPlan(document, plan.plan);

    assert.strictEqual(
      updated,
      [
        "import React, { useCallback } from 'react';",
        '',
        'const handleClick = useCallback(async () => {',
        "    await Promise.resolve('ok');",
        '}, []);',
        '',
      ].join('\n'),
    );
  });

  test('should report already-wrapped callbacks as unsupported', async () => {
    const content = [
      "import { useCallback } from 'react';",
      '',
      'const handleClick = useCallback(() => {',
      "    console.log('clicked');",
      '}, []);',
      '',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'useCallback(() =>');

    const result = service.createPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected wrap plan to fail for already wrapped callback');
    if (!result.success) {
      assert.strictEqual(result.reason, 'already-wrapped');
    }
  });

  test('should return not-found when selection does not cover a function initializer', async () => {
    const content = [
      'const value = 42;',
    ].join('\n');
    const document = await createDocument(content);
    const selection = selectSubstring(document, '42');

    const result = service.createPlan(document, selection);
    assert.strictEqual(result.success, false, 'Expected wrap plan to fail when no function is selected');
    if (!result.success) {
      assert.strictEqual(result.reason, 'not-found');
    }
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: 'typescriptreact', content });
}

function selectSubstring(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `Target substring not found: ${target}`);
  const start = document.positionAt(index);
  const end = document.positionAt(index + target.length);
  return new vscode.Selection(start, end);
}

function caretAt(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `Target substring not found: ${target}`);
  const caret = document.positionAt(index + Math.floor(target.length / 2));
  return new vscode.Selection(caret, caret);
}

function applyPlan(document: vscode.TextDocument, plan: UseCallbackWrapPlanSuccess['plan']): string {
  const original = document.getText();
  const edits = [...plan.edits].sort((left, right) => {
    const leftStart = document.offsetAt(left.range.start);
    const rightStart = document.offsetAt(right.range.start);
    return rightStart - leftStart;
  });

  let updated = original;
  for (const edit of edits) {
    const start = document.offsetAt(edit.range.start);
    const end = document.offsetAt(edit.range.end);
    updated = `${updated.slice(0, start)}${edit.newText}${updated.slice(end)}`;
  }

  return updated;
}

// Coverage commentary: Exercises wrapping for arrow and function expressions, React import augmentation, import synthesis, and failure modes.
// Future enhancements: Detect dependency array contents automatically and support property assignment initializers.
// Validation: Fully automated via in-memory documents; no manual intervention required.
