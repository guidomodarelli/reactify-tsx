import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type MergePlanFailureReason = 'not-found' | 'unsupported';

export interface MergePlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface MergePlanSuccess {
  readonly success: true;
  readonly plan: MergePlan;
}

export interface MergePlanFailure {
  readonly success: false;
  readonly reason: MergePlanFailureReason;
}

export type MergePlanResult = MergePlanSuccess | MergePlanFailure;

export class NestedIfMergeService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createMergePlan(document: vscode.TextDocument, selection: vscode.Selection): MergePlanResult {
    let scriptKind = this.scriptKindResolver.resolve(document);
    // Prefer TSX/JSX to accommodate JSX in then-branch bodies
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

    const outerIf = this.locateIfStatement(sourceFile, selectionStart, selectionEnd);
    if (!outerIf) {
      return { success: false, reason: 'not-found' } satisfies MergePlanFailure;
    }

    if (outerIf.elseStatement) {
      return { success: false, reason: 'unsupported' } satisfies MergePlanFailure;
    }

    const innerIf = this.extractDirectInnerIf(outerIf);
    if (!innerIf || innerIf.elseStatement) {
      return { success: false, reason: 'unsupported' } satisfies MergePlanFailure;
    }

    const merged = this.buildMergedIf(outerIf.expression, innerIf.expression, innerIf.thenStatement);
    const range = getRangeFromNode(document, sourceFile, outerIf);
    const printed = this.normalizeJsxSelfClosingSpacing(
      this.printer.printNode(ts.EmitHint.Unspecified, merged, sourceFile),
    );
    const baseIndent = this.getBaseIndent(document, outerIf);
    const newText = this.prefixBaseIndentOnZeroIndentLines(printed, baseIndent);

    return { success: true, plan: { range, newText } } satisfies MergePlanSuccess;
  }

  private getBaseIndent(document: vscode.TextDocument, node: ts.Node): string {
    const line = document.positionAt(node.getStart()).line;
    const text = document.lineAt(line).text;
    const match = text.match(/^\s*/);
    return match ? match[0] : '';
  }

  private prefixBaseIndentOnZeroIndentLines(text: string, baseIndent: string): string {
    if (baseIndent.length === 0) return text;
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return text;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Prefix base indent only when the printer emitted no leading whitespace
      if (!/^\s/.test(line)) {
        lines[i] = baseIndent + line;
      }
    }
    return lines.join('\n');
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

  private extractDirectInnerIf(outerIf: ts.IfStatement): ts.IfStatement | undefined {
    const thenPart = outerIf.thenStatement;
    if (ts.isIfStatement(thenPart)) {
      return thenPart;
    }
    if (ts.isBlock(thenPart)) {
      if (thenPart.statements.length !== 1) {
        return undefined;
      }
      const only = thenPart.statements[0];
      return ts.isIfStatement(only) ? only : undefined;
    }
    return undefined;
  }

  private buildMergedIf(
    outerCondition: ts.Expression,
    innerCondition: ts.Expression,
    innerThen: ts.Statement,
  ): ts.IfStatement {
    const left = this.parenthesizeIfNeeded(outerCondition);
    const right = this.parenthesizeIfNeeded(innerCondition);
    const combined = ts.factory.createBinaryExpression(
      left,
      ts.factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
      right,
    );

    const preparedThen = this.prepareThen(innerThen);
    return ts.factory.createIfStatement(combined, preparedThen, undefined);
  }

  private prepareThen(statement: ts.Statement): ts.Statement {
    if (ts.isBlock(statement)) {
      return this.cloneBlock(statement);
    }
    if (ts.isEmptyStatement(statement)) {
      return ts.factory.createBlock([], true);
    }
    return this.cloneStatement(statement);
  }

  private cloneStatement<T extends ts.Statement>(statement: T): T {
    const factory = ts.factory as unknown as { cloneNode<U extends ts.Node>(node: U): U };
    return factory.cloneNode(statement) as T;
  }

  private cloneBlock(block: ts.Block): ts.Block {
    const statements = block.statements.map((s) => this.cloneStatement(s));
    return ts.factory.createBlock(statements, true);
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
