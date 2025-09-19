import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type FlipPlanFailureReason = 'not-found' | 'no-else' | 'unsupported';

export interface FlipPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface FlipPlanSuccess {
  readonly success: true;
  readonly plan: FlipPlan;
}

export interface FlipPlanFailure {
  readonly success: false;
  readonly reason: FlipPlanFailureReason;
}

export type FlipPlanResult = FlipPlanSuccess | FlipPlanFailure;

interface FlippedStatementResult {
  readonly guard: ts.IfStatement;
  readonly trailingStatements: readonly ts.Statement[];
}

export class IfElseFlipService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createFlipPlan(document: vscode.TextDocument, selection: vscode.Selection): FlipPlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
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
    if (ifStatement) {
      if (!ifStatement.elseStatement) {
        return { success: false, reason: 'no-else' } satisfies FlipPlanFailure;
      }

      const flipped = this.buildFlippedStatement(ifStatement);
      if (!flipped) {
        return { success: false, reason: 'unsupported' } satisfies FlipPlanFailure;
      }

      const range = getRangeFromNode(document, sourceFile, ifStatement);
      const newText = this.renderFlippedStatement(sourceFile, flipped);

      return {
        success: true,
        plan: {
          range,
          newText,
        },
      } satisfies FlipPlanSuccess;
    }

    const conditionalExpression = this.locateConditionalExpression(sourceFile, selectionStart, selectionEnd);
    if (!conditionalExpression) {
      return { success: false, reason: 'not-found' } satisfies FlipPlanFailure;
    }

    const flippedConditional = this.buildFlippedConditionalExpression(conditionalExpression);
    const range = getRangeFromNode(document, sourceFile, conditionalExpression);
    const newText = this.printer.printNode(ts.EmitHint.Unspecified, flippedConditional, sourceFile);

    return {
      success: true,
      plan: {
        range,
        newText,
      },
    } satisfies FlipPlanSuccess;
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

  private buildFlippedStatement(ifStatement: ts.IfStatement): FlippedStatementResult | undefined {
    const { elseStatement } = ifStatement;
    if (!elseStatement) {
      return undefined;
    }

    const negatedCondition = this.negateExpression(ifStatement.expression);
    const preparedThen = this.prepareThenStatement(elseStatement);
    const preparedElse = this.prepareElseStatement(ifStatement.thenStatement);

    if (this.shouldDropElseBranch(elseStatement)) {
      return {
        guard: ts.factory.createIfStatement(negatedCondition, preparedThen, undefined),
        trailingStatements: this.toStatementList(preparedElse),
      } satisfies FlippedStatementResult;
    }

    return {
      guard: ts.factory.createIfStatement(negatedCondition, preparedThen, preparedElse),
      trailingStatements: [],
    } satisfies FlippedStatementResult;
  }

  private renderFlippedStatement(sourceFile: ts.SourceFile, flipped: FlippedStatementResult): string {
    const guardText = this.normalizePrintedIfStatement(
      this.printer.printNode(ts.EmitHint.Unspecified, flipped.guard, sourceFile),
    );

    if (flipped.trailingStatements.length === 0) {
      return guardText;
    }

    const trailingText = flipped.trailingStatements
      .map((statement) => this.printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile))
      .join('\n\n');

    return `${guardText}\n\n${trailingText}`;
  }

  private buildFlippedConditionalExpression(
    expression: ts.ConditionalExpression,
  ): ts.ConditionalExpression {
    const negatedCondition = this.negateExpression(expression.condition);

    return ts.factory.createConditionalExpression(
      negatedCondition,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      expression.whenFalse,
      ts.factory.createToken(ts.SyntaxKind.ColonToken),
      expression.whenTrue,
    );
  }

  private prepareThenStatement(statement: ts.Statement): ts.Statement {
    if (ts.isBlock(statement)) {
      return statement;
    }

    if (ts.isIfStatement(statement)) {
      return ts.factory.createBlock([statement], true);
    }

    if (ts.isEmptyStatement(statement)) {
      return ts.factory.createBlock([], true);
    }

    return statement;
  }

  private prepareElseStatement(statement: ts.Statement): ts.Statement {
    if (ts.isBlock(statement)) {
      return statement;
    }

    if (ts.isEmptyStatement(statement)) {
      return ts.factory.createBlock([], true);
    }

    return statement;
  }

  private negateExpression(expression: ts.Expression): ts.Expression {
    if (ts.isParenthesizedExpression(expression)) {
      return ts.factory.createParenthesizedExpression(this.negateExpression(expression.expression));
    }

    if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
      return this.stripParentheses(expression.operand);
    }

    if (ts.isLiteralExpression(expression) || ts.isTemplateExpression(expression)) {
      return ts.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        this.parenthesizeIfNeeded(expression),
      );
    }

    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
      return ts.factory.createFalse();
    }

    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
      return ts.factory.createTrue();
    }

    if (ts.isBinaryExpression(expression)) {
      const negated = this.negateBinaryExpression(expression);
      if (negated) {
        return negated;
      }
    }

    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.ExclamationToken,
      this.parenthesizeIfNeeded(expression),
    );
  }

  private normalizePrintedIfStatement(text: string): string {
    return text.replace(/}\s*\r?\n\s*else/g, '} else');
  }

  private shouldDropElseBranch(statement: ts.Statement): boolean {
    return this.isTerminatingStatement(statement);
  }

  private isTerminatingStatement(statement: ts.Statement): boolean {
    if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
      return true;
    }

    if (ts.isContinueStatement(statement) || ts.isBreakStatement(statement)) {
      return true;
    }

    if (ts.isBlock(statement)) {
      if (statement.statements.length === 0) {
        return false;
      }
      const last = statement.statements[statement.statements.length - 1];
      return this.isTerminatingStatement(last);
    }

    if (ts.isIfStatement(statement) && statement.elseStatement) {
      return (
        this.isTerminatingStatement(statement.thenStatement) &&
        this.isTerminatingStatement(statement.elseStatement)
      );
    }

    return false;
  }

  private toStatementList(statement: ts.Statement): ts.Statement[] {
    return [statement];
  }
  private stripParentheses(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  private negateBinaryExpression(expression: ts.BinaryExpression): ts.Expression | undefined {
    const operator = expression.operatorToken.kind;

    switch (operator) {
      case ts.SyntaxKind.AmpersandAmpersandToken:
        return ts.factory.createBinaryExpression(
          this.negateExpression(expression.left),
          ts.factory.createToken(ts.SyntaxKind.BarBarToken),
          this.negateExpression(expression.right),
        );
      case ts.SyntaxKind.BarBarToken:
        return ts.factory.createBinaryExpression(
          this.negateExpression(expression.left),
          ts.factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
          this.negateExpression(expression.right),
        );
      default: {
        const mapped = this.getNegatedComparison(operator);
        if (mapped) {
          return ts.factory.createBinaryExpression(
            expression.left,
            mapped,
            expression.right,
          );
        }
        return undefined;
      }
    }
  }

  private getNegatedComparison(operator: ts.BinaryOperator): ts.BinaryOperator | undefined {
    switch (operator) {
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
        return ts.SyntaxKind.ExclamationEqualsEqualsToken;
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        return ts.SyntaxKind.EqualsEqualsEqualsToken;
      case ts.SyntaxKind.EqualsEqualsToken:
        return ts.SyntaxKind.ExclamationEqualsToken;
      case ts.SyntaxKind.ExclamationEqualsToken:
        return ts.SyntaxKind.EqualsEqualsToken;
      case ts.SyntaxKind.GreaterThanToken:
        return ts.SyntaxKind.LessThanEqualsToken;
      case ts.SyntaxKind.GreaterThanEqualsToken:
        return ts.SyntaxKind.LessThanToken;
      case ts.SyntaxKind.LessThanToken:
        return ts.SyntaxKind.GreaterThanEqualsToken;
      case ts.SyntaxKind.LessThanEqualsToken:
        return ts.SyntaxKind.GreaterThanToken;
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
}
