import type * as ts from 'typescript';
import type * as vscode from 'vscode';

export type FunctionNode = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

export type FunctionKind = 'arrow' | 'functionExpression' | 'functionDeclaration';

export interface VariableContext {
  readonly declaration: ts.VariableDeclaration;
  readonly declarationList: ts.VariableDeclarationList;
  readonly statement: ts.VariableStatement;
  readonly declarationIndex: number;
}

export interface FunctionContext {
  readonly kind: FunctionKind;
  readonly node: FunctionNode;
  readonly variableContext?: VariableContext;
}

export enum FunctionTransformationId {
  ArrowToFunctionExpression = 'arrow-to-function-expression',
  FunctionExpressionToArrow = 'function-expression-to-arrow',
  ArrowVariableToFunctionDeclaration = 'arrow-variable-to-function-declaration',
  FunctionExpressionVariableToFunctionDeclaration = 'function-expression-variable-to-function-declaration',
  FunctionDeclarationToArrowVariable = 'function-declaration-to-arrow-variable',
  FunctionDeclarationToFunctionExpressionVariable = 'function-declaration-to-function-expression-variable',
}

export type TransformationBindingWarning = 'binding-change';

export type TransformationWarning = TransformationBindingWarning | 'types-review-required';

export interface TransformationEdit {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface TransformationPlan {
  readonly edits: readonly TransformationEdit[];
  readonly warnings?: readonly TransformationWarning[];
  readonly newSelection?: vscode.Selection;
}

export interface TransformationChoice {
  readonly id: FunctionTransformationId;
  readonly label: string;
  readonly detail?: string;
}

export interface TransformationOptions {
  readonly desiredName?: string;
  readonly addRenameFixme?: boolean;
}

export interface TransformationPlanSuccess {
  readonly success: true;
  readonly plan: TransformationPlan;
}

export interface TransformationPlanFailure {
  readonly success: false;
  readonly message: string;
}

export type TransformationPlanResult = TransformationPlanSuccess | TransformationPlanFailure;

export interface AnalyzeResultSuccess {
  readonly success: true;
  readonly context: FunctionContext;
  readonly sourceFile: ts.SourceFile;
}

export interface AnalyzeResultFailure {
  readonly success: false;
  readonly message: string;
}

export type AnalyzeResult = AnalyzeResultSuccess | AnalyzeResultFailure;
