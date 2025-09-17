import * as assert from 'assert';
import * as vscode from 'vscode';
import { FunctionTransformationService } from '../services/functionTransformationService';
import {
  FunctionTransformationId,
  TransformationPlan,
  TransformationOptions,
} from '../models/functionTransformation';

suite('FunctionTransformationService', () => {
  const service = new FunctionTransformationService();

  test('converts arrow function to function expression', async () => {
    const content = 'const fn = () => 42;';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '() => 42');

    const plan = await planFor(document, selection, FunctionTransformationId.ArrowToFunctionExpression, service);
    const updated = applyPlan(document, plan);

    assert.strictEqual(updated, 'const fn = function () {\n    return 42;\n};');
    assert.strictEqual(plan.warnings, undefined);
  });

  test('promotes arrow variable to function declaration and flags type review', async () => {
    const content = 'const handler: (value: number) => void = (value) => console.log(value);';
    const document = await createDocument(content);
    const selection = selectSubstring(document, '(value) => console.log(value)');

    const plan = await planFor(
      document,
      selection,
      FunctionTransformationId.ArrowVariableToFunctionDeclaration,
      service,
    );

    const updated = applyPlan(document, plan);

    assert.strictEqual(
      updated,
      '// FIXME: review types\nfunction handler(value) {\n    return console.log(value);\n}',
    );
    assert.ok(plan.warnings);
    assert.ok(plan.warnings?.includes('types-review-required'));
  });

  test('converts function expression to arrow and warns about binding changes', async () => {
    const content = 'const handler = function () { return this.value; };';
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'function () { return this.value; }');

    const plan = await planFor(
      document,
      selection,
      FunctionTransformationId.FunctionExpressionToArrow,
      service,
    );

    assert.ok(plan.warnings?.includes('binding-change'));

    const updated = applyPlan(document, plan);
    assert.strictEqual(
      updated,
      'const handler = () => {\n    return this.value;\n};',
    );
  });

  test('converts default export function declaration to arrow variable with rename note', async () => {
    const content = 'export default async function () {\n    return 1;\n}';
    const document = await createDocument(content);
    const selection = selectSubstring(document, 'export default async function () {\n    return 1;\n}');

    const plan = await planFor(
      document,
      selection,
      FunctionTransformationId.FunctionDeclarationToArrowVariable,
      service,
      { desiredName: 'convertedFunction1', addRenameFixme: true },
    );

    const updated = applyPlan(document, plan);
    assert.strictEqual(
      updated,
      '// FIXME: rename\nconst convertedFunction1 = async () => {\n    return 1;\n};\nexport default convertedFunction1;',
    );
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

async function planFor(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  id: FunctionTransformationId,
  service: FunctionTransformationService,
  options?: TransformationOptions,
): Promise<TransformationPlan> {
  const analysis = service.analyze(document, selection);
  assert.ok(analysis.success, 'Expected analysis to succeed');
  const planResult = service.createTransformationPlan(
    document,
    analysis.sourceFile,
    analysis.context,
    id,
    options,
  );

  assert.ok(planResult.success, 'Expected plan creation to succeed');
  return planResult.plan;
}

function applyPlan(document: vscode.TextDocument, plan: TransformationPlan): string {
  const sorted = [...plan.edits].sort((a, b) => {
    const aOffset = document.offsetAt(a.range.start);
    const bOffset = document.offsetAt(b.range.start);
    return bOffset - aOffset;
  });

  let content = document.getText();
  for (const edit of sorted) {
    const start = document.offsetAt(edit.range.start);
    const end = document.offsetAt(edit.range.end);
    content = `${content.slice(0, start)}${edit.newText}${content.slice(end)}`;
  }

  return content;
}
