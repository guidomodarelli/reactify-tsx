import type * as vscode from 'vscode';

export type VariableSplitFailureReason = 'not-found' | 'unsupported';

export interface VariableSplitPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface VariableSplitPlanSuccess {
  readonly success: true;
  readonly plan: VariableSplitPlan;
}

export interface VariableSplitPlanFailure {
  readonly success: false;
  readonly reason: VariableSplitFailureReason;
}

export type VariableSplitPlanResult = VariableSplitPlanSuccess | VariableSplitPlanFailure;

