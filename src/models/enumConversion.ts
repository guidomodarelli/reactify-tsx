import type * as vscode from 'vscode';

export type EnumConversionFailureReason = 'not-found' | 'unsupported';

export interface EnumConversionPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface EnumConversionPlanSuccess {
  readonly success: true;
  readonly plan: EnumConversionPlan;
}

export interface EnumConversionPlanFailure {
  readonly success: false;
  readonly reason: EnumConversionFailureReason;
}

export type EnumConversionPlanResult = EnumConversionPlanSuccess | EnumConversionPlanFailure;
