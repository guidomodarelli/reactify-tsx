import * as vscode from 'vscode';
import * as ts from 'typescript';
import { FunctionTransformationService } from '../services/functionTransformationService';
import {
  FunctionTransformationId,
  FunctionContext,
  TransformationChoice,
  TransformationOptions,
} from '../models/functionTransformation';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_FUNCTION_IN_SELECTION_MESSAGE,
  NO_AVAILABLE_TRANSFORMATIONS_MESSAGE,
  SELECT_TRANSFORMATION_PLACEHOLDER,
  TRANSFORMATION_SUCCESS_MESSAGE,
  TRANSFORMATION_APPLY_FAILURE_MESSAGE,
  TRANSFORMATION_BINDING_WARNING_MESSAGE,
  TRANSFORMATION_CONTINUE_ACTION,
  TRANSFORMATION_CANCEL_ACTION,
  TRANSFORMATION_TYPES_REVIEW_MESSAGE,
  REQUEST_FUNCTION_NAME_PROMPT,
  INVALID_IDENTIFIER_MESSAGE,
} from '../constants/messages';

interface TransformationPickItem extends vscode.QuickPickItem {
  readonly id: FunctionTransformationId;
}

const transformationService = new FunctionTransformationService();

export async function transformFunctionCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const analysis = transformationService.analyze(document, selection);
  if (!analysis.success) {
    vscode.window.showInformationMessage(NO_FUNCTION_IN_SELECTION_MESSAGE);
    return;
  }

  const choices = transformationService.listAvailableTransformations(analysis.context);
  if (choices.length === 0) {
    vscode.window.showInformationMessage(NO_AVAILABLE_TRANSFORMATIONS_MESSAGE);
    return;
  }

  const pick = await vscode.window.showQuickPick(transformChoicesToItems(choices), {
    placeHolder: SELECT_TRANSFORMATION_PLACEHOLDER,
    canPickMany: false,
  });

  if (!pick) {
    return;
  }

  const options = await resolveTransformationOptions(pick.id, analysis.context, document);
  if (options === null) {
    return;
  }

  const planResult = transformationService.createTransformationPlan(
    document,
    analysis.sourceFile,
    analysis.context,
    pick.id,
    options ?? undefined,
  );

  if (!planResult.success) {
    vscode.window.showErrorMessage(planResult.message ?? TRANSFORMATION_APPLY_FAILURE_MESSAGE);
    return;
  }

  const { plan } = planResult;

  if (plan.warnings?.includes('binding-change')) {
    const choice = await vscode.window.showWarningMessage(
      TRANSFORMATION_BINDING_WARNING_MESSAGE,
      { modal: true },
      TRANSFORMATION_CONTINUE_ACTION,
      TRANSFORMATION_CANCEL_ACTION,
    );

    if (choice !== TRANSFORMATION_CONTINUE_ACTION) {
      return;
    }
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  plan.edits.forEach((edit) => {
    workspaceEdit.replace(document.uri, edit.range, edit.newText);
  });

  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applied) {
    vscode.window.showErrorMessage(TRANSFORMATION_APPLY_FAILURE_MESSAGE);
    return;
  }

  if (plan.newSelection) {
    editor.selection = plan.newSelection;
    editor.revealRange(plan.newSelection, vscode.TextEditorRevealType.Default);
  }

  vscode.window.showInformationMessage(TRANSFORMATION_SUCCESS_MESSAGE);

  if (plan.warnings?.includes('types-review-required')) {
    vscode.window.showWarningMessage(TRANSFORMATION_TYPES_REVIEW_MESSAGE);
  }
}

function transformChoicesToItems(choices: readonly TransformationChoice[]): TransformationPickItem[] {
  return choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    description: choice.detail,
  }));
}

async function resolveTransformationOptions(
  id: FunctionTransformationId,
  context: FunctionContext,
  document: vscode.TextDocument,
): Promise<TransformationOptions | null | undefined> {
  if (
    (id === FunctionTransformationId.FunctionDeclarationToArrowVariable ||
      id === FunctionTransformationId.FunctionDeclarationToFunctionExpressionVariable) &&
    ts.isFunctionDeclaration(context.node) &&
    !context.node.name
  ) {
    const suggestedName = generatePlaceholderName(document);
    const desiredName = await vscode.window.showInputBox({
      prompt: REQUEST_FUNCTION_NAME_PROMPT,
      value: suggestedName,
      validateInput: (value) => (isValidIdentifier(value) ? undefined : INVALID_IDENTIFIER_MESSAGE),
    });

    if (!desiredName) {
      return null;
    }

    return {
      desiredName,
      addRenameFixme: desiredName === suggestedName,
    } satisfies TransformationOptions;
  }

  return undefined;
}

function generatePlaceholderName(document: vscode.TextDocument): string {
  const base = 'convertedFunction';
  const text = document.getText();
  let suffix = 1;

  while (suffix < 1000) {
    const candidate = `${base}${suffix}`;
    const regex = new RegExp(`\\b${candidate}\\b`, 'g');
    if (!regex.test(text)) {
      return candidate;
    }
    suffix += 1;
  }

  return `${base}${Date.now()}`;
}

function isValidIdentifier(value: string): boolean {
  if (!value) {
    return false;
  }

  const extendedTs = ts as typeof ts & {
    isIdentifierText?: (text: string, languageVersion: ts.ScriptTarget, identifierVariant?: unknown) => boolean;
  };

  if (typeof extendedTs.isIdentifierText === 'function') {
    return extendedTs.isIdentifierText(value, ts.ScriptTarget.ESNext);
  }

  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}
