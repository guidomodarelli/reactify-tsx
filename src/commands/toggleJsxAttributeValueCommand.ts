import * as vscode from 'vscode';
import { JsxAttributeValueToggleService } from '../services/jsxAttributeValueToggleService';
import {
  JSX_ATTRIBUTE_TOGGLE_APPLY_FAILURE_MESSAGE,
  JSX_ATTRIBUTE_TOGGLE_UNSUPPORTED_MESSAGE,
  JSX_ATTRIBUTE_TOGGLE_UNWRAP_SUCCESS_MESSAGE,
  JSX_ATTRIBUTE_TOGGLE_WRAP_SUCCESS_MESSAGE,
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_JSX_ATTRIBUTE_IN_SELECTION_MESSAGE,
} from '../constants/messages';

const toggleService = new JsxAttributeValueToggleService();

export async function toggleJsxAttributeValueCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = toggleService.createTogglePlan(document, selection);

  if (!result.success) {
    const message = result.reason === 'not-found'
      ? NO_JSX_ATTRIBUTE_IN_SELECTION_MESSAGE
      : JSX_ATTRIBUTE_TOGGLE_UNSUPPORTED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(JSX_ATTRIBUTE_TOGGLE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  const successMessage = result.plan.mode === 'wrap'
    ? JSX_ATTRIBUTE_TOGGLE_WRAP_SUCCESS_MESSAGE
    : JSX_ATTRIBUTE_TOGGLE_UNWRAP_SUCCESS_MESSAGE;
  vscode.window.showInformationMessage(successMessage);
}
