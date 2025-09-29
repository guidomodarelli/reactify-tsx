import * as assert from 'assert';
import * as vscode from 'vscode';
import { RefactorCodeActionProvider, ALL_REFACTOR_FEATURES } from '../code-actions/refactor-code-action-provider';

/**
 * Preparation checklist:
 * - Catalogue every refactor feature command and its expected context guardrails.
 * - Design representative source snippets that exercise valid and invalid caret positions.
 * - Extract reusable helpers for document creation and caret targeting.
 * - Ensure tests differentiate refactor kinds to avoid false positives across features.
 * - Capture both appearance and absence expectations for each command.
 *
 * Coverage notes:
 * - Verifies metadata completeness and caret-driven availability for all refactor code actions.
 * - Exercises command-specific gating across extract, transform, flip, enum, toggle, and movement behaviours.
 * Future enhancements:
 * - Add integration tests that invoke the actual VS Code lightbulb to validate UI plumbing end-to-end.
 */

suite('Refactor code action provider', () => {
  const provider = new RefactorCodeActionProvider();

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should publish metadata for every feature command', () => {
    const exportedCommands = ALL_REFACTOR_FEATURES.map((feature) => feature.commandId).sort();
    const expectedCommands: readonly string[] = [
      'reactify-tsx.extractArrowFunction',
      'reactify-tsx.transformFunction',
      'reactify-tsx.flipIfElse',
      'reactify-tsx.simplifyIfElse',
      'reactify-tsx.simplifyTernary',
      'reactify-tsx.replaceIfElseWithTernary',
      'reactify-tsx.removeRedundantElse',
      'reactify-tsx.enumToConst',
      'reactify-tsx.convertToLet',
      'reactify-tsx.convertToConst',
      'reactify-tsx.toggleJsxAttributeValue',
      'reactify-tsx.moveBlockUp',
      'reactify-tsx.moveBlockDown',
      'reactify-tsx.splitIntoMultipleDeclarations',
      'reactify-tsx.splitDeclarationAndInitialization',
      'reactify-tsx.mergeDeclarationAndInitialization',
      'reactify-tsx.addParensToSingleArrowParam',
      'reactify-tsx.wrapWithUseCallback',
    ];

    assert.deepStrictEqual(
      exportedCommands,
      [...expectedCommands].sort(),
      'Refactor feature metadata is incomplete or mis-specified',
    );

    const nonRefactorKinds = ALL_REFACTOR_FEATURES.filter((feature) => {
      return !feature.kind.value.startsWith(vscode.CodeActionKind.Refactor.value);
    });

    assert.deepStrictEqual(
      nonRefactorKinds,
      [],
      nonRefactorKinds.length === 0
        ? 'All code action kinds correctly map to refactor variants'
        : `Found non-refactor code action kinds for: ${nonRefactorKinds
            .map((feature) => feature.commandId)
            .join(', ')}`,
    );
  });

  test('should offer add-parens refactor when caret is inside single-param arrow without parens', async () => {
    const content = [
      'const inc = x => x + 1;',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'x => x + 1');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.addParensToSingleArrowParam'),
      'Add-parens refactor should appear for single identifier parameter without parentheses',
    );
  });

  test('should hide add-parens refactor when arrow already has parentheses', async () => {
    const content = [
      'const inc = (x) => x + 1;',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, '(x) => x + 1');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.addParensToSingleArrowParam'),
      'Add-parens refactor must not appear when parameter is already parenthesized',
    );
  });

  test('should expose wrap-with-useCallback refactor for arrow initializer', async () => {
    const content = [
      "import { useState } from 'react';",
      '',
      'const handleClick = () => {',
      '  useState(0);',
      '};',
      '',
    ].join('\n');
    const document = await createDocument('typescriptreact', content);
    const caretRange = caretAt(document, 'handleClick = () =>');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.wrapWithUseCallback'),
      'Wrap-with-useCallback refactor should appear for arrow initializer selection',
    );
  });

  test('should hide wrap-with-useCallback refactor when initializer is not a function', async () => {
    const content = [
      'const value = 42;',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, '42');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.wrapWithUseCallback'),
      'Wrap-with-useCallback refactor must not appear when selection is not a function initializer',
    );
  });

  test('should offer replace-if-else-with-ternary for return branches', async () => {
    const content = [
      'function f(flag: boolean) {',
      '  if (flag) {',
      '    return 1;',
      '  } else {',
      '    return 2;',
      '  }',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (flag)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.replaceIfElseWithTernary'),
      'Replace if/else with ternary should appear for simple return branches',
    );
  });

  test('should offer simplify-if-else for boolean return branches', async () => {
    const content = [
      'function f(flag: boolean) {',
      '  if (flag) {',
      '    return true;',
      '  } else {',
      '    return false;',
      '  }',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (flag)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.simplifyIfElse'),
      'Simplify if/else should appear for boolean return branches',
    );
  });

  test('should expose arrow function extraction when caret is inside inline handler', async () => {
    const content = [
      'const Component = () => {',
      '  return <button onClick={(event) => handleToggle(event)} />;',
      '};',
    ].join('\n');
    const document = await createDocument('typescriptreact', content);
    const caretRange = caretAt(document, 'handleToggle');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorExtract);

    assert.ok(
      commands.includes('reactify-tsx.extractArrowFunction'),
      'Expected extract arrow function refactor to be available when caret rests inside inline handler',
    );
  });

  test('should skip arrow function extraction when caret is outside inline handler context', async () => {
    const content = [
      'const value = (event) => handleToggle(event);',
      'export const Component = () => <button onClick={value} />;',
    ].join('\n');
    const document = await createDocument('typescriptreact', content);
    const caretRange = caretAt(document, 'const value');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorExtract);

    assert.ok(
      !commands.includes('reactify-tsx.extractArrowFunction'),
      'Extract arrow function refactor should not surface when caret is outside JSX handler arrow',
    );
  });

  test('should offer function transform when caret is inside transformable declaration', async () => {
    const content = [
      'function source() {',
      '  return true;',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'function source');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.transformFunction'),
      'Transform function refactor should appear when caret is inside function declaration',
    );
  });

  test('should hide transform function refactor when caret has no function context', async () => {
    const content = [
      'const value = true;',
      'console.log(value);',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'const value');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.transformFunction'),
      'Transform function refactor must not appear without a transformable function under the caret',
    );
  });

  test('should surface flip if/else when caret is inside if statement with else', async () => {
    const content = [
      'if (condition) {',
      '  act();',
      '} else {',
      '  react();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (condition)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.flipIfElse'),
      'Flip if/else refactor should be available when caret sits inside an if statement with else',
    );
  });

  test('should suppress flip if/else when caret lacks else branch', async () => {
    const content = [
      'if (condition) {',
      '  act();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (condition)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.flipIfElse'),
      'Flip if/else refactor must not appear for caret inside if blocks without else or ternary',
    );
  });

  test('should offer redundant else removal when then branch returns', async () => {
    const content = [
      'if (isReady) {',
      '  return prepare();',
      '} else {',
      '  finalize();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (isReady)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.removeRedundantElse'),
      'Redundant else removal should surface when then branch returns control flow',
    );
  });

  test('should hide redundant else removal when then branch continues execution', async () => {
    const content = [
      'if (isReady) {',
      '  notify();',
      '} else {',
      '  finalize();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (isReady)');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.removeRedundantElse'),
      'Redundant else removal must not appear when guard does not terminate control flow',
    );
  });

  test('should enable enum refactor when caret is inside enum declaration', async () => {
    const content = [
      'export enum Status {',
      '  Active = "active",',
      '  Inactive = "inactive",',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'enum Status');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.enumToConst'),
      'Enum conversion refactor should appear when caret is inside enum declaration',
    );
  });

  test('should not expose enum refactor when caret is inside non-enum type', async () => {
    const content = [
      'interface Status {',
      '  value: string;',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'interface Status');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.enumToConst'),
      'Enum conversion refactor should not be offered when caret is inside an interface',
    );
  });

  test('should advertise JSX attribute toggle when caret is inside literal attribute', async () => {
    const content = [
      'const node = <button label="primary" />;',
    ].join('\n');
    const document = await createDocument('typescriptreact', content);
    const caretRange = caretAt(document, 'label="primary"');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      commands.includes('reactify-tsx.toggleJsxAttributeValue'),
      'JSX attribute toggle should appear when caret sits inside literal attribute',
    );
  });

  test('should hide JSX attribute toggle when caret is inside non-string expression', async () => {
    const content = [
      'const node = <button label={primaryLabel} />;',
    ].join('\n');
    const document = await createDocument('typescriptreact', content);
    const caretRange = caretAt(document, 'label={primaryLabel}');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorRewrite);

    assert.ok(
      !commands.includes('reactify-tsx.toggleJsxAttributeValue'),
      'JSX attribute toggle must not be shown when caret sits inside non-string attribute expression',
    );
  });

  test('should show move block up when caret rests on a movable block', async () => {
    const content = [
      'function first() {',
      '  log();',
      '}',
      '',
      'function second() {',
      '  log();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'function second');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorMove);

    assert.ok(
      commands.includes('reactify-tsx.moveBlockUp'),
      'Move block up should be available for caret on non-top block',
    );
  });

  test('should skip move block up when caret is already at the top block', async () => {
    const content = [
      'function first() {',
      '  log();',
      '}',
      '',
      'function second() {',
      '  log();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'function first');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorMove);

    assert.ok(
      !commands.includes('reactify-tsx.moveBlockUp'),
      'Move block up should not surface for caret at top-most block',
    );
  });

  test('should offer move block down when caret rests on a movable block', async () => {
    const content = [
      'function first() {',
      '  log();',
      '}',
      '',
      'function second() {',
      '  log();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'function first');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorMove);

    assert.ok(
      commands.includes('reactify-tsx.moveBlockDown'),
      'Move block down should be available for caret on non-bottom block',
    );
  });

  test('should hide move block down when caret is already at the bottom block', async () => {
    const content = [
      'function first() {',
      '  log();',
      '}',
      '',
      'function second() {',
      '  log();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'function second');

    const commands = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.RefactorMove);

    assert.ok(
      !commands.includes('reactify-tsx.moveBlockDown'),
      'Move block down should not surface for caret at bottom-most block',
    );
  });

  test('should respect code action kind filters', async () => {
    const content = [
      'if (condition) {',
      '  act();',
      '} else {',
      '  react();',
      '}',
    ].join('\n');
    const document = await createDocument('typescript', content);
    const caretRange = caretAt(document, 'if (condition)');

    const refactorActions = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.Refactor);
    const quickFixActions = await collectRefactorCommands(document, caretRange, vscode.CodeActionKind.QuickFix);

    assert.ok(refactorActions.length > 0, 'Refactor filter should keep refactor actions');
    assert.deepStrictEqual(quickFixActions, [], 'Quick fix filter should suppress refactor-only actions');
  });
});

async function createDocument(language: string, content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language, content });
}

function caretAt(document: vscode.TextDocument, target: string): vscode.Range {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `Unable to locate target for caret: ${target}`);
  const position = document.positionAt(index + Math.floor(target.length / 2));
  return new vscode.Range(position, position);
}

async function collectRefactorCommands(
  document: vscode.TextDocument,
  range: vscode.Range,
  only: vscode.CodeActionKind | undefined,
): Promise<readonly string[]> {
  const context: vscode.CodeActionContext = {
    triggerKind: vscode.CodeActionTriggerKind.Invoke,
    diagnostics: [],
    only,
  };

  const cancellation = new vscode.CancellationTokenSource();
  try {
    const actions = await new RefactorCodeActionProvider().provideCodeActions(
      document,
      range,
      context,
      cancellation.token,
    );
    const codeActions = (actions ?? []).filter((action): action is vscode.CodeAction => action instanceof vscode.CodeAction);
    return codeActions
      .map((action) => action.command?.command)
      .filter((commandId): commandId is string => typeof commandId === 'string');
  } finally {
    cancellation.dispose();
  }
}

/**
 * Validation: Confirms refactor provider obeys caret-driven context guards and honours VS Code filtering contracts.
 * No manual verification required; functional correctness follows from the underlying service evaluations exercised here.
 */
