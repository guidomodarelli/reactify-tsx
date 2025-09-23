import * as vscode from 'vscode';
import { StringTemplateToggleService } from '../services/stringTemplateToggleService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_STRING_OR_TEMPLATE_IN_SELECTION_MESSAGE,
  STRING_TEMPLATE_TOGGLE_APPLY_FAILURE_MESSAGE,
  STRING_TEMPLATE_TOGGLE_UNSUPPORTED_MESSAGE,
  STRING_TO_TEMPLATE_SUCCESS_MESSAGE,
  TEMPLATE_TO_STRING_SUCCESS_MESSAGE,
} from '../constants/messages';

const toggleService = new StringTemplateToggleService();

export async function toggleStringTemplateCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = toggleService.createTogglePlan(document, selection);

  if (!result.success) {
    const message = result.reason === 'not-found'
      ? NO_STRING_OR_TEMPLATE_IN_SELECTION_MESSAGE
      : STRING_TEMPLATE_TOGGLE_UNSUPPORTED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(STRING_TEMPLATE_TOGGLE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  const successMessage = result.plan.mode === 'to-template'
    ? STRING_TO_TEMPLATE_SUCCESS_MESSAGE
    : TEMPLATE_TO_STRING_SUCCESS_MESSAGE;
  vscode.window.showInformationMessage(successMessage);
}

