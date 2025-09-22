import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type AttributeTogglePlanFailureReason = 'not-found' | 'unsupported';

export interface AttributeTogglePlan {
  readonly range: vscode.Range;
  readonly newText: string;
  readonly mode: 'wrap' | 'unwrap';
}

export interface AttributeTogglePlanSuccess {
  readonly success: true;
  readonly plan: AttributeTogglePlan;
}

export interface AttributeTogglePlanFailure {
  readonly success: false;
  readonly reason: AttributeTogglePlanFailureReason;
}

export type AttributeTogglePlanResult = AttributeTogglePlanSuccess | AttributeTogglePlanFailure;

export class JsxAttributeValueToggleService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createTogglePlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): AttributeTogglePlanResult {
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

    const attribute = this.locateAttribute(sourceFile, selectionStart, selectionEnd);
    if (!attribute) {
      return { success: false, reason: 'not-found' } satisfies AttributeTogglePlanFailure;
    }

    const initializer = attribute.initializer;
    if (!initializer) {
      return { success: false, reason: 'unsupported' } satisfies AttributeTogglePlanFailure;
    }

    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
      return this.buildWrapPlan(document, sourceFile, initializer);
    }

    if (ts.isJsxExpression(initializer) && initializer.expression) {
      return this.buildExpressionPlan(document, sourceFile, initializer);
    }

    return { success: false, reason: 'unsupported' } satisfies AttributeTogglePlanFailure;
  }

  private buildWrapPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  ): AttributeTogglePlanResult {
    const literalRange = getRangeFromNode(document, sourceFile, literal);
    const literalText = literal.getText(sourceFile);

    return {
      success: true,
      plan: {
        range: literalRange,
        newText: `{${literalText}}`,
        mode: 'wrap',
      },
    } satisfies AttributeTogglePlanSuccess;
  }

  private buildExpressionPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    expression: ts.JsxExpression,
  ): AttributeTogglePlanResult {
    const inner = expression.expression;
    if (!inner) {
      return { success: false, reason: 'unsupported' } satisfies AttributeTogglePlanFailure;
    }

    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) {
      const expressionRange = getRangeFromNode(document, sourceFile, expression);
      const innerText = inner.getText(sourceFile);

      return {
        success: true,
        plan: {
          range: expressionRange,
          newText: innerText,
          mode: 'unwrap',
        },
      } satisfies AttributeTogglePlanSuccess;
    }

    return { success: false, reason: 'unsupported' } satisfies AttributeTogglePlanFailure;
  }

  private locateAttribute(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.JsxAttribute | undefined {
    let match: ts.JsxAttribute | undefined;

    const visit = (node: ts.Node) => {
      if (match) {
        return;
      }

      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }

      if (ts.isJsxAttribute(node)) {
        match = node;
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return match;
  }
}
