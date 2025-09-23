import * as vscode from 'vscode';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_IF_STATEMENT_IN_SELECTION_MESSAGE,
  REDUNDANT_ELSE_APPLY_FAILURE_MESSAGE,
  REDUNDANT_ELSE_NO_BRANCH_MESSAGE,
  REDUNDANT_ELSE_NOT_REDUNDANT_MESSAGE,
  REDUNDANT_ELSE_SUCCESS_MESSAGE,
  REDUNDANT_ELSE_UNSUPPORTED_MESSAGE,
} from '../constants/messages';
import { RedundantElseRemovalService } from '../services/redundantElseRemovalService';

const service = new RedundantElseRemovalService();

export async function removeRedundantElseCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createRemovalPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_IF_STATEMENT_IN_SELECTION_MESSAGE);
        return;
      case 'no-else':
        vscode.window.showInformationMessage(REDUNDANT_ELSE_NO_BRANCH_MESSAGE);
        return;
      case 'not-redundant':
        vscode.window.showInformationMessage(REDUNDANT_ELSE_NOT_REDUNDANT_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(REDUNDANT_ELSE_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(REDUNDANT_ELSE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(REDUNDANT_ELSE_SUCCESS_MESSAGE);
}
