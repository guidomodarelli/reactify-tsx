import * as vscode from 'vscode';
import { EnumToConstService } from '../services/enumToConstService';
import {
  ENUM_CONVERSION_APPLY_FAILURE_MESSAGE,
  ENUM_CONVERSION_SUCCESS_MESSAGE,
  ENUM_CONVERSION_UNSUPPORTED_MESSAGE,
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_ENUM_IN_SELECTION_MESSAGE,
} from '../constants/messages';

const enumToConstService = new EnumToConstService();

export async function enumToConstCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = enumToConstService.createConversionPlan(document, selection);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_ENUM_IN_SELECTION_MESSAGE);
        return;
      case 'unsupported':
        vscode.window.showInformationMessage(ENUM_CONVERSION_UNSUPPORTED_MESSAGE);
        return;
      default:
        return;
    }
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(ENUM_CONVERSION_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);

  vscode.window.showInformationMessage(ENUM_CONVERSION_SUCCESS_MESSAGE);
}
