import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type SimplifyConditionalFailureReason = 'not-found' | 'unsupported';

export interface SimplifyConditionalPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface SimplifyConditionalPlanSuccess {
  readonly success: true;
  readonly plan: SimplifyConditionalPlan;
}

export interface SimplifyConditionalPlanFailure {
  readonly success: false;
  readonly reason: SimplifyConditionalFailureReason;
}

export type SimplifyConditionalPlanResult =
  | SimplifyConditionalPlanSuccess
  | SimplifyConditionalPlanFailure;

export class ConditionalSimplifyService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createSimplifyPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): SimplifyConditionalPlanResult {
    let scriptKind = this.scriptKindResolver.resolve(document);
    // Prefer TSX/JSX parsing to accommodate JSX branches even in .ts/.js
    if (scriptKind === ts.ScriptKind.TS) scriptKind = ts.ScriptKind.TSX;
    if (scriptKind === ts.ScriptKind.JS) scriptKind = ts.ScriptKind.JSX;

    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    const conditional = this.locateConditionalExpression(sourceFile, selectionStart, selectionEnd);
    if (!conditional) {
      return { success: false, reason: 'not-found' } satisfies SimplifyConditionalPlanFailure;
    }

    const simplified =
      this.trySimplifyBooleanLiterals(conditional) ??
      this.trySimplifyIdenticalBranches(sourceFile, conditional);

    if (!simplified) {
      return { success: false, reason: 'unsupported' } satisfies SimplifyConditionalPlanFailure;
    }

    const range = getRangeFromNode(document, sourceFile, conditional);
    const newText = this.normalizeJsxSelfClosingSpacing(
      this.printer.printNode(ts.EmitHint.Unspecified, simplified, sourceFile),
    );
    return { success: true, plan: { range, newText } } satisfies SimplifyConditionalPlanSuccess;
  }

  private locateConditionalExpression(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.ConditionalExpression | undefined {
    let bestMatch: ts.ConditionalExpression | undefined;
    const visit = (node: ts.Node) => {
      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }
      if (ts.isConditionalExpression(node)) {
        bestMatch = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return bestMatch;
  }

  private trySimplifyBooleanLiterals(
    expression: ts.ConditionalExpression,
  ): ts.Expression | undefined {
    const whenTrue = expression.whenTrue;
    const whenFalse = expression.whenFalse;
    const isTrue = (node: ts.Expression) => node.kind === ts.SyntaxKind.TrueKeyword;
    const isFalse = (node: ts.Expression) => node.kind === ts.SyntaxKind.FalseKeyword;

    if (isTrue(whenTrue) && isTrue(whenFalse)) {
      return ts.factory.createTrue();
    }
    if (isFalse(whenTrue) && isFalse(whenFalse)) {
      return ts.factory.createFalse();
    }
    if (isTrue(whenTrue) && isFalse(whenFalse)) {
      // !!condition to preserve boolean type semantics
      return this.toBoolean(expression.condition);
    }
    if (isFalse(whenTrue) && isTrue(whenFalse)) {
      return this.negateExpression(expression.condition);
    }

    return undefined;
  }

  private trySimplifyIdenticalBranches(
    sourceFile: ts.SourceFile,
    expression: ts.ConditionalExpression,
  ): ts.Expression | undefined {
    const a = this.printer
      .printNode(ts.EmitHint.Unspecified, expression.whenTrue, sourceFile)
      .replace(/\s+/g, '');
    const b = this.printer
      .printNode(ts.EmitHint.Unspecified, expression.whenFalse, sourceFile)
      .replace(/\s+/g, '');
    if (a === b) {
      return expression.whenTrue;
    }
    return undefined;
  }

  private toBoolean(expr: ts.Expression): ts.Expression {
    // !!(expr) with minimal parentheses
    const inner = this.parenthesizeIfNeeded(this.stripParentheses(expr));
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.ExclamationToken,
      ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, inner),
    );
  }

  private negateExpression(expression: ts.Expression): ts.Expression {
    const stripped = this.stripParentheses(expression);

    if (stripped.kind === ts.SyntaxKind.TrueKeyword) return ts.factory.createFalse();
    if (stripped.kind === ts.SyntaxKind.FalseKeyword) return ts.factory.createTrue();

    if (ts.isBinaryExpression(stripped)) {
      const negated = this.negateBinaryExpression(stripped);
      if (negated) return negated;
    }

    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.ExclamationToken,
      this.parenthesizeIfNeeded(stripped),
    );
  }

  private stripParentheses(expr: ts.Expression): ts.Expression {
    let current = expr;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  private negateBinaryExpression(expression: ts.BinaryExpression): ts.Expression | undefined {
    const operator = expression.operatorToken.kind;
    switch (operator) {
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.ExclamationEqualsEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.EqualsEqualsEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.EqualsEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.ExclamationEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.ExclamationEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.EqualsEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.GreaterThanToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.LessThanEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.GreaterThanEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.LessThanToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.LessThanToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.GreaterThanEqualsToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      case ts.SyntaxKind.LessThanEqualsToken:
        return ts.factory.createBinaryExpression(
          expression.left,
          ts.SyntaxKind.GreaterThanToken as unknown as ts.BinaryOperatorToken,
          expression.right,
        );
      default:
        return undefined;
    }
  }

  private parenthesizeIfNeeded(expression: ts.Expression): ts.Expression {
    if (ts.isParenthesizedExpression(expression)) {
      return expression;
    }
    switch (expression.kind) {
      case ts.SyntaxKind.Identifier:
      case ts.SyntaxKind.ThisKeyword:
      case ts.SyntaxKind.SuperKeyword:
      case ts.SyntaxKind.NullKeyword:
      case ts.SyntaxKind.TrueKeyword:
      case ts.SyntaxKind.FalseKeyword:
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.BigIntLiteral:
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        return expression;
      default:
        break;
    }
    if (
      ts.isCallExpression(expression) ||
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression) ||
      ts.isNewExpression(expression) ||
      ts.isPrefixUnaryExpression(expression) ||
      ts.isAwaitExpression(expression) ||
      ts.isTypeOfExpression(expression) ||
      ts.isVoidExpression(expression) ||
      ts.isDeleteExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isTemplateExpression(expression)
    ) {
      return expression;
    }
    return ts.factory.createParenthesizedExpression(expression);
  }

  private normalizeJsxSelfClosingSpacing(text: string): string {
    return text.replace(/>\/>/g, ' />');
  }
}

