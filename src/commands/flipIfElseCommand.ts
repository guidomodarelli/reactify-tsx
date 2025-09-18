import * as vscode from 'vscode';
import {
  IF_ELSE_FLIP_APPLY_FAILURE_MESSAGE,
  IF_ELSE_FLIP_SUCCESS_MESSAGE,
  IF_ELSE_FLIP_UNSUPPORTED_MESSAGE,
  IF_STATEMENT_REQUIRES_ELSE_MESSAGE,
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_IF_STATEMENT_IN_SELECTION_MESSAGE,
} from '../constants/messages';
import { IfElseFlipService } from '../services/ifElseFlipService';

const flipService = new IfElseFlipService();

export async function flipIfElseCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = flipService.createFlipPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_IF_STATEMENT_IN_SELECTION_MESSAGE);
        return;
      case 'no-else':
        vscode.window.showInformationMessage(IF_STATEMENT_REQUIRES_ELSE_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(IF_ELSE_FLIP_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(IF_ELSE_FLIP_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(IF_ELSE_FLIP_SUCCESS_MESSAGE);
}
