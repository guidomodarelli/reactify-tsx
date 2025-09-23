import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type ArrowBodyTogglePlanFailureReason = 'not-found' | 'unsupported';

export interface ArrowBodyTogglePlan {
  readonly range: vscode.Range;
  readonly newText: string;
  readonly mode: 'to-block' | 'to-expression';
}

export interface ArrowBodyTogglePlanSuccess {
  readonly success: true;
  readonly plan: ArrowBodyTogglePlan;
}

export interface ArrowBodyTogglePlanFailure {
  readonly success: false;
  readonly reason: ArrowBodyTogglePlanFailureReason;
}

export type ArrowBodyTogglePlanResult = ArrowBodyTogglePlanSuccess | ArrowBodyTogglePlanFailure;

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class ArrowBodyToggleService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createTogglePlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): ArrowBodyTogglePlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const selectionStart = Math.min(document.offsetAt(selection.start), document.offsetAt(selection.end));
    const selectionEnd = Math.max(document.offsetAt(selection.start), document.offsetAt(selection.end));

    const arrow = this.locateArrowFunction(sourceFile, selectionStart, selectionEnd);
    if (!arrow) {
      return { success: false, reason: 'not-found' } satisfies ArrowBodyTogglePlanFailure;
    }

    if (ts.isBlock(arrow.body)) {
      return this.buildToExpressionPlan(document, sourceFile, arrow);
    }

    return this.buildToBlockPlan(document, sourceFile, arrow);
  }

  private buildToBlockPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    arrow: ts.ArrowFunction,
  ): ArrowBodyTogglePlanResult {
    const bodyExpression = arrow.body as unknown as ts.Expression; // only called when body is expression
    const body = ts.factory.createBlock([ts.factory.createReturnStatement(bodyExpression)], true);
    const updated = ts.factory.createArrowFunction(
      arrow.modifiers,
      arrow.typeParameters,
      arrow.parameters,
      arrow.type,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body,
    );

    const range = getRangeFromNode(document, sourceFile, arrow);
    const newText = printer.printNode(ts.EmitHint.Expression, updated, sourceFile);
    return { success: true, plan: { range, newText, mode: 'to-block' } } satisfies ArrowBodyTogglePlanSuccess;
  }

  private buildToExpressionPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    arrow: ts.ArrowFunction,
  ): ArrowBodyTogglePlanResult {
    const block = arrow.body as ts.Block;
    if (block.statements.length !== 1) {
      return { success: false, reason: 'unsupported' } satisfies ArrowBodyTogglePlanFailure;
    }

    const only = block.statements[0];
    if (!ts.isReturnStatement(only) || !only.expression) {
      return { success: false, reason: 'unsupported' } satisfies ArrowBodyTogglePlanFailure;
    }

    const updated = ts.factory.createArrowFunction(
      arrow.modifiers,
      arrow.typeParameters,
      arrow.parameters,
      arrow.type,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      only.expression,
    );

    const range = getRangeFromNode(document, sourceFile, arrow);
    const newText = printer.printNode(ts.EmitHint.Expression, updated, sourceFile);
    return { success: true, plan: { range, newText, mode: 'to-expression' } } satisfies ArrowBodyTogglePlanSuccess;
  }

  private locateArrowFunction(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.ArrowFunction | undefined {
    let match: ts.ArrowFunction | undefined;

    const visit = (node: ts.Node) => {
      if (match) {
        return;
      }

      const nodeStart = node.getStart(sourceFile, true);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }

      if (ts.isArrowFunction(node)) {
        match = node;
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return match;
  }
}
