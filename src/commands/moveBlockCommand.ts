import * as vscode from 'vscode';
import {
  BLOCK_MOVE_APPLY_FAILURE_MESSAGE,
  BLOCK_MOVE_AT_BOTTOM_MESSAGE,
  BLOCK_MOVE_AT_TOP_MESSAGE,
  NO_ACTIVE_EDITOR_MESSAGE,
  NO_MOVABLE_BLOCK_MESSAGE,
} from '../constants/messages';
import { BlockMovementService, MoveBlockDirection } from '../services/blockMovementService';

const movementService = new BlockMovementService();

export async function moveBlockUpCommand(): Promise<void> {
  await executeBlockMovement('up');
}

export async function moveBlockDownCommand(): Promise<void> {
  await executeBlockMovement('down');
}

async function executeBlockMovement(direction: MoveBlockDirection): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const { document, selection } = editor;
  const result = movementService.createMovePlan(document, selection, direction);

  if (!result.success) {
    switch (result.reason) {
      case 'not-found':
        vscode.window.showInformationMessage(NO_MOVABLE_BLOCK_MESSAGE);
        return;
      case 'at-boundary':
        vscode.window.showInformationMessage(
          direction === 'up' ? BLOCK_MOVE_AT_TOP_MESSAGE : BLOCK_MOVE_AT_BOTTOM_MESSAGE,
        );
        return;
      default:
        return;
    }
  }

  const rangeStartOffset = document.offsetAt(result.plan.range.start);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, result.plan.range, result.plan.newText);

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    vscode.window.showErrorMessage(BLOCK_MOVE_APPLY_FAILURE_MESSAGE);
    return;
  }

  const anchorOffset = rangeStartOffset + result.plan.anchorRelativeOffset;
  const anchorPosition = document.positionAt(anchorOffset);

  editor.selection = new vscode.Selection(anchorPosition, anchorPosition);
  editor.revealRange(new vscode.Range(anchorPosition, anchorPosition), vscode.TextEditorRevealType.Default);
}
