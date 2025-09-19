import * as assert from 'assert';
import * as vscode from 'vscode';
import type { ArrowFunctionExtractionPlan } from '../models/componentContext';
import { ArrowFunctionExtractionService } from '../services/arrowFunctionExtractionService';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { ArrowFunctionLocator } from '../services/arrowFunctionLocator';
import { ComponentContextResolver } from '../services/componentContextResolver';
import { HandlerNameFactory } from '../services/handlerNameFactory';
import { ReactEventTypeResolver } from '../services/reactEventTypeResolver';
import { ParameterTextBuilder } from '../services/parameterTextBuilder';
import { ArrowBodyBuilder } from '../services/arrowBodyBuilder';
import { InsertionPlanner } from '../services/insertionPlanner';
import { IndentationService } from '../utils/indentationService';
import { SELECT_ARROW_FUNCTION_MESSAGE, UNSUPPORTED_COMPONENT_CONTEXT_MESSAGE } from '../constants/messages';

suite('ArrowFunctionExtractionService', () => {
  const extractionService = new ArrowFunctionExtractionService(
    new ScriptKindResolver(),
    new ArrowFunctionLocator(),
    new ComponentContextResolver(),
    new HandlerNameFactory(),
    new ParameterTextBuilder(new ReactEventTypeResolver()),
    new ArrowBodyBuilder(),
    new InsertionPlanner(new IndentationService()),
  );

  test('extracts inline handler inside function component with inferred event type', async () => {
    const content = [
      "import React from 'react';",
      '',
      'type Props = {',
      '  onToggle: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;',
      '  todo: { id: string; label: string };',
      '};',
      '',
      'export function TodoItem({ onToggle, todo }: Props) {',
      '  return (',
      '    <button onClick={(event) => onToggle(todo.id, event)}> {todo.label} </button>',
      '  );',
      '}',
      '',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, '(event) => onToggle(todo.id, event)');

    const result = extractionService.createExtractionPlan(document, selection, { tabSize: 2, insertSpaces: true });
    assert.ok(result.success, 'expected extraction to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        "import React from 'react';",
        '',
        'type Props = {',
        '  onToggle: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;',
        '  todo: { id: string; label: string };',
        '};',
        '',
        'export function TodoItem({ onToggle, todo }: Props) {',
        '  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => onToggle(todo.id, event);',
        '',
        '  return (',
        '    <button onClick={handleClick}> {todo.label} </button>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
  });

  test('creates unique handler name when base name already exists', async () => {
    const content = [
      'export function Example({ onClick }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {',
      "  const handleClick = () => console.log('existing');",
      '',
      '  return <button onClick={(event) => onClick(event)} />;',
      '}',
      '',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, '(event) => onClick(event)');

    const result = extractionService.createExtractionPlan(document, selection, undefined);
    assert.ok(result.success, 'expected extraction to succeed');

    const updated = applyPlan(document, result.plan);
    assert.strictEqual(
      updated,
      [
        'export function Example({ onClick }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {',
        "  const handleClick = () => console.log('existing');",
        '  const handleClick2 = (event: React.MouseEvent<HTMLButtonElement>) => onClick(event);',
        '',
        '  return <button onClick={handleClick2} />;',
        '}',
        '',
      ].join('\n'),
    );
  });

  test('fails when selected arrow is outside supported component context', async () => {
    const content = [
      'export const Stateless = ({ onToggle }: { onToggle: () => void }) => (',
      '  <button onClick={() => onToggle()} />',
      ');',
      '',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, '() => onToggle()');

    const result = extractionService.createExtractionPlan(document, selection, undefined);
    assert.ok(!result.success, 'expected extraction to fail');
    if (result.success) {
      return;
    }

    assert.strictEqual(result.message, UNSUPPORTED_COMPONENT_CONTEXT_MESSAGE);
  });

  test('fails when no arrow function is selected', async () => {
    const content = [
      'export function Example() {',
      '  return <button>Click</button>;',
      '}',
      '',
    ].join('\n');

    const document = await createDocument(content);
    const selection = selectSubstring(document, 'button');

    const result = extractionService.createExtractionPlan(document, selection, undefined);
    assert.ok(!result.success, 'expected extraction to fail');
    if (result.success) {
      return;
    }

    assert.strictEqual(result.message, SELECT_ARROW_FUNCTION_MESSAGE);
  });
});

async function createDocument(content: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: 'typescriptreact', content });
}

function selectSubstring(document: vscode.TextDocument, target: string): vscode.Selection {
  const fullText = document.getText();
  const index = fullText.indexOf(target);
  assert.ok(index >= 0, `substring not found: ${target}`);
  const start = document.positionAt(index);
  const end = document.positionAt(index + target.length);
  return new vscode.Selection(start, end);
}

function applyPlan(
  document: vscode.TextDocument,
  plan: ArrowFunctionExtractionPlan,
): string {
  const edits = [
    {
      start: document.offsetAt(plan.handlerInsertion.insertPosition),
      end: document.offsetAt(plan.handlerInsertion.insertPosition),
      text: plan.handlerInsertion.insertText,
    },
    {
      start: document.offsetAt(plan.arrowRange.start),
      end: document.offsetAt(plan.arrowRange.end),
      text: plan.replacementText,
    },
  ].sort((left, right) => right.start - left.start);

  let content = document.getText();
  for (const { start, end, text } of edits) {
    content = `${content.slice(0, start)}${text}${content.slice(end)}`;
  }

  return content;
}
