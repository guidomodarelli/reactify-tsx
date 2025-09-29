import * as vscode from 'vscode';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_IF_STATEMENT_IN_SELECTION_MESSAGE,
  REPLACE_IF_ELSE_TERNARY_APPLY_FAILURE_MESSAGE,
  REPLACE_IF_ELSE_TERNARY_NO_BRANCH_MESSAGE,
  REPLACE_IF_ELSE_TERNARY_UNSUPPORTED_MESSAGE,
  REPLACE_IF_ELSE_TERNARY_SUCCESS_MESSAGE,
} from '../constants/messages';
import { IfElseToConditionalService } from '../services/ifElseToConditionalService';

const service = new IfElseToConditionalService();

export async function replaceIfElseWithTernaryCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createReplacePlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_IF_STATEMENT_IN_SELECTION_MESSAGE);
        return;
      case 'no-else':
        vscode.window.showInformationMessage(REPLACE_IF_ELSE_TERNARY_NO_BRANCH_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(REPLACE_IF_ELSE_TERNARY_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(REPLACE_IF_ELSE_TERNARY_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(REPLACE_IF_ELSE_TERNARY_SUCCESS_MESSAGE);
}

