import type * as vscode from 'vscode';

export type VariableKindTarget = 'let' | 'const';

export type VariableKindConversionFailureReason = 'not-found' | 'unsupported';

export interface VariableKindConversionPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface VariableKindConversionPlanSuccess {
  readonly success: true;
  readonly plan: VariableKindConversionPlan;
}

export interface VariableKindConversionPlanFailure {
  readonly success: false;
  readonly reason: VariableKindConversionFailureReason;
}

export type VariableKindConversionPlanResult =
  | VariableKindConversionPlanSuccess
  | VariableKindConversionPlanFailure;

