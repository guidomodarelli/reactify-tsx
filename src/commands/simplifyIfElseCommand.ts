import * as vscode from 'vscode';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_IF_STATEMENT_IN_SELECTION_MESSAGE,
  SIMPLIFY_IF_ELSE_NO_BRANCH_MESSAGE,
  SIMPLIFY_IF_ELSE_UNSUPPORTED_MESSAGE,
  SIMPLIFY_IF_ELSE_APPLY_FAILURE_MESSAGE,
  SIMPLIFY_IF_ELSE_SUCCESS_MESSAGE,
} from '../constants/messages';
import { IfElseSimplifyService } from '../services/ifElseSimplifyService';

const service = new IfElseSimplifyService();

export async function simplifyIfElseCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createSimplifyPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_IF_STATEMENT_IN_SELECTION_MESSAGE);
        return;
      case 'no-else':
        vscode.window.showInformationMessage(SIMPLIFY_IF_ELSE_NO_BRANCH_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(SIMPLIFY_IF_ELSE_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(SIMPLIFY_IF_ELSE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(SIMPLIFY_IF_ELSE_SUCCESS_MESSAGE);
}

