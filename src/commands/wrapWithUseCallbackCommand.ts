import * as vscode from 'vscode';
import { UseCallbackWrapFailureReason } from '../models/useCallbackWrap';
import { UseCallbackWrapService } from '../services/useCallbackWrapService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  USE_CALLBACK_WRAP_NOT_FOUND_MESSAGE,
  USE_CALLBACK_WRAP_UNSUPPORTED_MESSAGE,
  USE_CALLBACK_WRAP_ALREADY_WRAPPED_MESSAGE,
  USE_CALLBACK_WRAP_APPLY_FAILURE_MESSAGE,
  USE_CALLBACK_WRAP_SUCCESS_MESSAGE,
} from '../constants/messages';

const wrapService = new UseCallbackWrapService();

export async function wrapWithUseCallbackCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = wrapService.createPlan(document, selection);

  if (!result.success) {
    const message = mapFailureReason(result.reason);
    vscode.window.showInformationMessage(message);
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of result.plan.edits) {
    workspaceEdit.replace(document.uri, edit.range, edit.newText);
  }

  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applied) {
    vscode.window.showErrorMessage(USE_CALLBACK_WRAP_APPLY_FAILURE_MESSAGE);
    return;
  }

  vscode.window.showInformationMessage(USE_CALLBACK_WRAP_SUCCESS_MESSAGE);
}

function mapFailureReason(reason: UseCallbackWrapFailureReason): string {
  switch (reason) {
    case 'not-found':
      return USE_CALLBACK_WRAP_NOT_FOUND_MESSAGE;
    case 'already-wrapped':
      return USE_CALLBACK_WRAP_ALREADY_WRAPPED_MESSAGE;
    default:
      return USE_CALLBACK_WRAP_UNSUPPORTED_MESSAGE;
  }
}
