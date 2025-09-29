import * as vscode from 'vscode';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_IF_STATEMENT_IN_SELECTION_MESSAGE,
  MERGE_NESTED_IF_UNSUPPORTED_MESSAGE,
  MERGE_NESTED_IF_APPLY_FAILURE_MESSAGE,
  MERGE_NESTED_IF_SUCCESS_MESSAGE,
} from '../constants/messages';
import { NestedIfMergeService } from '../services/nestedIfMergeService';

const service = new NestedIfMergeService();

export async function mergeNestedIfCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createMergePlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_IF_STATEMENT_IN_SELECTION_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(MERGE_NESTED_IF_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(MERGE_NESTED_IF_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(MERGE_NESTED_IF_SUCCESS_MESSAGE);
}

