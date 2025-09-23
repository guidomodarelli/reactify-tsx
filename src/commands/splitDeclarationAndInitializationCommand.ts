import * as vscode from 'vscode';
import { VariableSplitService } from '../services/variableSplitService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE,
  VARIABLE_SPLIT_UNSUPPORTED_MESSAGE,
  VARIABLE_SPLIT_APPLY_FAILURE_MESSAGE,
  VARIABLE_SPLIT_DECL_INIT_SUCCESS_MESSAGE,
} from '../constants/messages';

const service = new VariableSplitService();

export async function splitDeclarationAndInitializationCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createSplitDeclarationAndInitializationPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(VARIABLE_SPLIT_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(VARIABLE_SPLIT_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(VARIABLE_SPLIT_DECL_INIT_SUCCESS_MESSAGE);
}

