import * as vscode from 'vscode';
import { ArrowParameterParensService } from '../services/arrowParameterParensService';
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_ARROW_FOR_PARAM_PARENS_MESSAGE,
  ARROW_PARAM_PARENS_UNSUPPORTED_MESSAGE,
  ARROW_PARAM_ALREADY_PARENTHESIZED_MESSAGE,
  ARROW_PARAM_PARENS_APPLY_FAILURE_MESSAGE,
  ARROW_PARAM_PARENS_SUCCESS_MESSAGE,
} from '../constants/messages';

const service = new ArrowParameterParensService();

export async function addParensToSingleArrowParamCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
    }

  const { document, selection } = editor;
  const result = service.createAddParensPlan(document, selection);

  if (!result.success) {
    const message = result.reason === 'not-found'
      ? NO_ARROW_FOR_PARAM_PARENS_MESSAGE
      : result.reason === 'unsupported'
        ? ARROW_PARAM_PARENS_UNSUPPORTED_MESSAGE
        : ARROW_PARAM_ALREADY_PARENTHESIZED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(ARROW_PARAM_PARENS_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);
  vscode.window.showInformationMessage(ARROW_PARAM_PARENS_SUCCESS_MESSAGE);
}

