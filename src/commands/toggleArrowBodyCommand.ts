import * as vscode from 'vscode';
import { ArrowBodyToggleService } from '../services/arrowBodyToggleService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_ARROW_FUNCTION_IN_SELECTION_MESSAGE,
  ARROW_BODY_TOGGLE_UNSUPPORTED_MESSAGE,
  ARROW_BODY_TOGGLE_APPLY_FAILURE_MESSAGE,
  ARROW_TO_BLOCK_SUCCESS_MESSAGE,
  ARROW_TO_EXPRESSION_SUCCESS_MESSAGE,
} from '../constants/messages';

const toggleService = new ArrowBodyToggleService();

export async function toggleArrowBodyCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = toggleService.createTogglePlan(document, selection);

  if (!result.success) {
    const message = result.reason === 'not-found'
      ? NO_ARROW_FUNCTION_IN_SELECTION_MESSAGE
      : ARROW_BODY_TOGGLE_UNSUPPORTED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(ARROW_BODY_TOGGLE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  const successMessage = result.plan.mode === 'to-block'
    ? ARROW_TO_BLOCK_SUCCESS_MESSAGE
    : ARROW_TO_EXPRESSION_SUCCESS_MESSAGE;
  vscode.window.showInformationMessage(successMessage);
}

