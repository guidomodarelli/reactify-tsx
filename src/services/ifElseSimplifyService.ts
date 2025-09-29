import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type SimplifyFailureReason = 'not-found' | 'no-else' | 'unsupported';

export interface SimplifyPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface SimplifyPlanSuccess {
  readonly success: true;
  readonly plan: SimplifyPlan;
}

export interface SimplifyPlanFailure {
  readonly success: false;
  readonly reason: SimplifyFailureReason;
}

export type SimplifyPlanResult = SimplifyPlanSuccess | SimplifyPlanFailure;

export class IfElseSimplifyService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createSimplifyPlan(document: vscode.TextDocument, selection: vscode.Selection): SimplifyPlanResult {
    let scriptKind = this.scriptKindResolver.resolve(document);
    // Prefer TSX/JSX to accommodate JSX in branch expressions
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

    const ifStatement = this.locateIfStatement(sourceFile, selectionStart, selectionEnd);
    if (!ifStatement) {
      return { success: false, reason: 'not-found' } satisfies SimplifyPlanFailure;
    }

    const elseStatement = ifStatement.elseStatement;
    if (!elseStatement) {
      return { success: false, reason: 'no-else' } satisfies SimplifyPlanFailure;
    }
    if (ts.isIfStatement(elseStatement)) {
      // else-if chains out of scope for this simplification
      return { success: false, reason: 'unsupported' } satisfies SimplifyPlanFailure;
    }

    const simplifiedReturn = this.trySimplifyReturn(sourceFile, ifStatement);
    if (simplifiedReturn) {
      const range = getRangeFromNode(document, sourceFile, ifStatement);
      const newText = this.normalizeJsxSelfClosingSpacing(
        this.printer.printNode(ts.EmitHint.Unspecified, simplifiedReturn, sourceFile),
      );
      return { success: true, plan: { range, newText } } satisfies SimplifyPlanSuccess;
    }

    const simplifiedAssignment = this.trySimplifyAssignment(sourceFile, ifStatement);
    if (simplifiedAssignment) {
      const range = getRangeFromNode(document, sourceFile, ifStatement);
      const newText = this.normalizeJsxSelfClosingSpacing(
        this.printer.printNode(ts.EmitHint.Unspecified, simplifiedAssignment, sourceFile),
      );
      return { success: true, plan: { range, newText } } satisfies SimplifyPlanSuccess;
    }

    return { success: false, reason: 'unsupported' } satisfies SimplifyPlanFailure;
  }

  private locateIfStatement(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.IfStatement | undefined {
    let bestMatch: ts.IfStatement | undefined;
    const visit = (node: ts.Node) => {
      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }
      if (ts.isIfStatement(node)) {
        bestMatch = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return bestMatch;
  }

  private trySimplifyReturn(sourceFile: ts.SourceFile, ifStatement: ts.IfStatement): ts.Statement | undefined {
    const thenBool = this.extractReturnBoolean(sourceFile, ifStatement.thenStatement);
    if (thenBool === undefined) return undefined;
    const elseBool = this.extractReturnBoolean(sourceFile, ifStatement.elseStatement!);
    if (elseBool === undefined) return undefined;

    // Same boolean on both sides => constant return
    if (thenBool === elseBool) {
      return ts.factory.createReturnStatement(thenBool ? ts.factory.createTrue() : ts.factory.createFalse());
    }

    // true/false => condition; false/true => !condition
    const expr = thenBool
      ? ifStatement.expression
      : this.negateExpression(ifStatement.expression);
    return ts.factory.createReturnStatement(expr);
  }

  private extractReturnBoolean(sourceFile: ts.SourceFile, statement: ts.Statement): boolean | undefined {
    const getBool = (node: ts.Statement): boolean | undefined => {
      if (!ts.isReturnStatement(node)) return undefined;
      const value = node.expression;
      if (!value) return undefined;
      if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
      return undefined;
    };

    if (ts.isBlock(statement)) {
      if (statement.statements.length !== 1) return undefined;
      return getBool(statement.statements[0]);
    }
    return getBool(statement);
  }

  private trySimplifyAssignment(sourceFile: ts.SourceFile, ifStatement: ts.IfStatement): ts.Statement | undefined {
    const thenAssign = this.extractBooleanAssignment(sourceFile, ifStatement.thenStatement);
    if (!thenAssign) return undefined;
    const elseAssign = this.extractBooleanAssignment(sourceFile, ifStatement.elseStatement!);
    if (!elseAssign) return undefined;

    const lhsThen = this.printer.printNode(ts.EmitHint.Unspecified, thenAssign.target, sourceFile).replace(/\s+/g, '');
    const lhsElse = this.printer.printNode(ts.EmitHint.Unspecified, elseAssign.target, sourceFile).replace(/\s+/g, '');
    if (lhsThen !== lhsElse) return undefined;

    if (thenAssign.value === elseAssign.value) {
      // constant assignment
      const assignment = ts.factory.createBinaryExpression(
        thenAssign.target,
        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
        thenAssign.value ? ts.factory.createTrue() : ts.factory.createFalse(),
      );
      return ts.factory.createExpressionStatement(assignment);
    }

    const rhs = thenAssign.value
      ? ifStatement.expression
      : this.negateExpression(ifStatement.expression);

    const assignment = ts.factory.createBinaryExpression(
      thenAssign.target,
      ts.factory.createToken(ts.SyntaxKind.EqualsToken),
      rhs,
    );
    return ts.factory.createExpressionStatement(assignment);
  }

  private extractBooleanAssignment(
    sourceFile: ts.SourceFile,
    statement: ts.Statement,
  ): { target: ts.Expression; value: boolean } | undefined {
    const tryExtract = (node: ts.Statement): { target: ts.Expression; value: boolean } | undefined => {
      if (!ts.isExpressionStatement(node)) return undefined;
      const expr = node.expression;
      if (!ts.isBinaryExpression(expr)) return undefined;
      if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined;
      const right = expr.right;
      if (right.kind === ts.SyntaxKind.TrueKeyword) return { target: expr.left, value: true };
      if (right.kind === ts.SyntaxKind.FalseKeyword) return { target: expr.left, value: false };
      return undefined;
    };

    if (ts.isBlock(statement)) {
      if (statement.statements.length !== 1) return undefined;
      return tryExtract(statement.statements[0]);
    }
    return tryExtract(statement);
  }

  private negateExpression(expression: ts.Expression): ts.Expression {
    if (ts.isParenthesizedExpression(expression)) {
      return ts.factory.createParenthesizedExpression(this.negateExpression(expression.expression));
    }

    if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
      return this.stripParentheses(expression.operand);
    }

    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
      return ts.factory.createFalse();
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
      return ts.factory.createTrue();
    }

    if (ts.isBinaryExpression(expression)) {
      const negated = this.negateBinaryExpression(expression);
      if (negated) return negated;
    }

    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.ExclamationToken,
      this.parenthesizeIfNeeded(expression),
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

