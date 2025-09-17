import * as vscode from 'vscode';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { ArrowFunctionLocator } from '../services/arrowFunctionLocator';
import { ComponentContextResolver } from '../services/componentContextResolver';
import { HandlerNameFactory } from '../services/handlerNameFactory';
import { ReactEventTypeResolver } from '../services/reactEventTypeResolver';
import { ParameterTextBuilder } from '../services/parameterTextBuilder';
import { ArrowBodyBuilder } from '../services/arrowBodyBuilder';
import { IndentationService } from '../utils/indentationService';
import { InsertionPlanner } from '../services/insertionPlanner';
import { ArrowFunctionExtractionService } from '../services/arrowFunctionExtractionService';
import {
  EXTRACTION_FAILED_MESSAGE,
  NO_ACTIVE_EDITOR_MESSAGE,
  RENAME_ACTION_ERROR,
  RENAME_COMMAND_ID,
  extractionSuccessMessage,
} from '../constants/messages';

const scriptKindResolver = new ScriptKindResolver();
const arrowFunctionLocator = new ArrowFunctionLocator();
const componentContextResolver = new ComponentContextResolver();
const handlerNameFactory = new HandlerNameFactory();
const reactEventTypeResolver = new ReactEventTypeResolver();
const parameterTextBuilder = new ParameterTextBuilder(reactEventTypeResolver);
const arrowBodyBuilder = new ArrowBodyBuilder();
const indentationService = new IndentationService();
const insertionPlanner = new InsertionPlanner(indentationService);

const extractionService = new ArrowFunctionExtractionService(
  scriptKindResolver,
  arrowFunctionLocator,
  componentContextResolver,
  handlerNameFactory,
  parameterTextBuilder,
  arrowBodyBuilder,
  insertionPlanner,
);

/**
 * Command entrypoint that initiates the arrow function extraction refactor.
 */
export async function extractArrowFunctionCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection, options } = editor;
  const result = extractionService.createExtractionPlan(document, selection, options);

  if (!result.success) {
    vscode.window.showErrorMessage(result.message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.arrowRange, result.plan.replacementText);
  edit.insert(document.uri, result.plan.handlerInsertion.insertPosition, result.plan.handlerInsertion.insertText);

  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    vscode.window.showErrorMessage(EXTRACTION_FAILED_MESSAGE);
    return;
  }

  await selectHandlerName(editor, result.plan.handlerInsertion.handlerDefinitionOffset, result.plan.handlerName);

  vscode.window.showInformationMessage(extractionSuccessMessage(result.plan.handlerName));
}

async function selectHandlerName(
  editor: vscode.TextEditor,
  handlerDefinitionOffset: number | undefined,
  handlerName: string,
): Promise<void> {
  if (typeof handlerDefinitionOffset !== 'number') {
    return;
  }

  const { document } = editor;
  const renameStart = document.positionAt(handlerDefinitionOffset);
  const renameEnd = renameStart.translate(0, handlerName.length);
  editor.selection = new vscode.Selection(renameStart, renameEnd);
  editor.revealRange(new vscode.Range(renameStart, renameEnd), vscode.TextEditorRevealType.Default);

  try {
    await vscode.commands.executeCommand(RENAME_COMMAND_ID);
  } catch (error) {
    console.error(RENAME_ACTION_ERROR, error);
  }
}
