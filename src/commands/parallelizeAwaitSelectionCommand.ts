import * as vscode from "vscode";
import { ParallelAwaitService } from "../services/parallelAwaitService";
import {
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_AWAIT_SEQUENCE_IN_SELECTION_MESSAGE,
  PARALLEL_AWAIT_UNSUPPORTED_MESSAGE,
  PARALLEL_AWAIT_APPLY_FAILURE_MESSAGE,
  PARALLEL_AWAIT_SUCCESS_MESSAGE,
} from "../constants/messages";

const service = new ParallelAwaitService();

export async function parallelizeAwaitSelectionCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = service.createPlan(document, selection);

  if (!result.success) {
    const message = result.reason === "not-found"
      ? NO_AWAIT_SEQUENCE_IN_SELECTION_MESSAGE
      : PARALLEL_AWAIT_UNSUPPORTED_MESSAGE;
    vscode.window.showInformationMessage(message);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(PARALLEL_AWAIT_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchor = result.plan.range.start;
  editor.selection = new vscode.Selection(anchor, anchor);
  editor.revealRange(new vscode.Range(anchor, anchor), vscode.TextEditorRevealType.Default);
  vscode.window.showInformationMessage(PARALLEL_AWAIT_SUCCESS_MESSAGE);
}