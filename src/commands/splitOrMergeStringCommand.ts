import * as vscode from 'vscode';
import { StringSplitMergeService } from '../services/stringSplitMergeService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_STRING_FOR_SPLIT_OR_MERGE_MESSAGE,
  STRING_MERGE_SUCCESS_MESSAGE,
  STRING_SPLIT_MERGE_APPLY_FAILURE_MESSAGE,
  STRING_SPLIT_MERGE_UNSUPPORTED_MESSAGE,
  STRING_SPLIT_SUCCESS_MESSAGE,
} from '../constants/messages';

const service = new StringSplitMergeService();

export async function splitOrMergeStringCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createPlan(document, selection);

  if (!result.success) {
    const message = result.reason === 'not-found'
      ? NO_STRING_FOR_SPLIT_OR_MERGE_MESSAGE
      : STRING_SPLIT_MERGE_UNSUPPORTED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(STRING_SPLIT_MERGE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  const successMessage = result.plan.mode === 'split' ? STRING_SPLIT_SUCCESS_MESSAGE : STRING_MERGE_SUCCESS_MESSAGE;
  vscode.window.showInformationMessage(successMessage);
}

