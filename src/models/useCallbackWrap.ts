import type * as vscode from 'vscode';

export type UseCallbackWrapFailureReason = 'not-found' | 'unsupported' | 'already-wrapped';

export interface UseCallbackWrapEdit {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface UseCallbackWrapPlan {
  readonly edits: readonly UseCallbackWrapEdit[];
}

export interface UseCallbackWrapPlanSuccess {
  readonly success: true;
  readonly plan: UseCallbackWrapPlan;
}

export interface UseCallbackWrapPlanFailure {
  readonly success: false;
  readonly reason: UseCallbackWrapFailureReason;
}

export type UseCallbackWrapPlanResult = UseCallbackWrapPlanSuccess | UseCallbackWrapPlanFailure;
