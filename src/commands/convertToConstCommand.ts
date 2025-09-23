import * as vscode from 'vscode';
import { VariableKindConversionService } from '../services/variableKindConversionService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE,
  VARIABLE_CONVERSION_APPLY_FAILURE_MESSAGE,
  VARIABLE_CONVERSION_TO_CONST_SUCCESS_MESSAGE,
  VARIABLE_CONVERSION_UNSUPPORTED_MESSAGE,
} from '../constants/messages';

const service = new VariableKindConversionService();

export async function convertToConstCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createConversionPlan(document, selection, 'const');

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(VARIABLE_CONVERSION_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(VARIABLE_CONVERSION_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(VARIABLE_CONVERSION_TO_CONST_SUCCESS_MESSAGE);
}

