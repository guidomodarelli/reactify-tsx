import * as vscode from 'vscode';
import { VariableMergeService } from '../services/variableMergeService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE,
  VARIABLE_MERGE_UNSUPPORTED_MESSAGE,
  VARIABLE_MERGE_APPLY_FAILURE_MESSAGE,
  VARIABLE_MERGE_SUCCESS_MESSAGE,
} from '../constants/messages';

const service = new VariableMergeService();

export async function mergeDeclarationAndInitializationCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createMergeDeclarationAndInitializationPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(VARIABLE_MERGE_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(VARIABLE_MERGE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(VARIABLE_MERGE_SUCCESS_MESSAGE);
}

