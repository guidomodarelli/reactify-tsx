import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type ReplacePlanFailureReason = 'not-found' | 'no-else' | 'unsupported';

export interface ReplacePlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface ReplacePlanSuccess {
  readonly success: true;
  readonly plan: ReplacePlan;
}

export interface ReplacePlanFailure {
  readonly success: false;
  readonly reason: ReplacePlanFailureReason;
}

export type ReplacePlanResult = ReplacePlanSuccess | ReplacePlanFailure;

export class IfElseToConditionalService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createReplacePlan(document: vscode.TextDocument, selection: vscode.Selection): ReplacePlanResult {
    let scriptKind = this.scriptKindResolver.resolve(document);
    // Be lenient: prefer TSX/JSX parsing to correctly handle JSX in return/assignment expressions
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
      return { success: false, reason: 'not-found' } satisfies ReplacePlanFailure;
    }

    if (!ifStatement.elseStatement) {
      return { success: false, reason: 'no-else' } satisfies ReplacePlanFailure;
    }

    if (ts.isIfStatement(ifStatement.elseStatement)) {
      return { success: false, reason: 'unsupported' } satisfies ReplacePlanFailure;
    }

    const returnPlan = this.tryReturnReplacement(sourceFile, ifStatement);
    if (returnPlan) {
      const range = getRangeFromNode(document, sourceFile, ifStatement);
      const newText = this.normalizeJsxSelfClosingSpacing(
        this.printer.printNode(ts.EmitHint.Unspecified, returnPlan, sourceFile),
      );
      return { success: true, plan: { range, newText } } satisfies ReplacePlanSuccess;
    }

    const assignmentPlan = this.tryAssignmentReplacement(sourceFile, ifStatement);
    if (assignmentPlan) {
      const range = getRangeFromNode(document, sourceFile, ifStatement);
      const newText = this.normalizeJsxSelfClosingSpacing(
        this.printer.printNode(ts.EmitHint.Unspecified, assignmentPlan, sourceFile),
      );
      return { success: true, plan: { range, newText } } satisfies ReplacePlanSuccess;
    }

    return { success: false, reason: 'unsupported' } satisfies ReplacePlanFailure;
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

  private tryReturnReplacement(
    sourceFile: ts.SourceFile,
    ifStatement: ts.IfStatement,
  ): ts.Statement | undefined {
    const thenExpr = this.extractReturnExpression(sourceFile, ifStatement.thenStatement);
    if (!thenExpr) {
      return undefined;
    }
    const elseExpr = this.extractReturnExpression(sourceFile, ifStatement.elseStatement!);
    if (!elseExpr) {
      return undefined;
    }

    const conditional = ts.factory.createConditionalExpression(
      ifStatement.expression,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      thenExpr,
      ts.factory.createToken(ts.SyntaxKind.ColonToken),
      elseExpr,
    );

    return ts.factory.createReturnStatement(conditional);
  }

  private extractReturnExpression(
    sourceFile: ts.SourceFile,
    statement: ts.Statement,
  ): ts.Expression | undefined {
    if (ts.isReturnStatement(statement)) {
      return statement.expression ?? undefined;
    }

    if (ts.isBlock(statement)) {
      if (statement.statements.length !== 1) {
        return undefined;
      }
      const only = statement.statements[0];
      if (ts.isReturnStatement(only)) {
        return only.expression ?? undefined;
      }
      return undefined;
    }

    // Single-line: if (c) return x; else return y;
    // Already handled by direct ReturnStatement checks above.
    const start = statement.getStart(sourceFile);
    const end = statement.getEnd();
    // Fallback path: non-return statements not supported here
    void start; // keep linter happy about unused
    void end;
    return undefined;
  }

  private tryAssignmentReplacement(
    sourceFile: ts.SourceFile,
    ifStatement: ts.IfStatement,
  ): ts.Statement | undefined {
    const thenAssign = this.extractSimpleAssignment(sourceFile, ifStatement.thenStatement);
    if (!thenAssign) {
      return undefined;
    }
    const elseAssign = this.extractSimpleAssignment(sourceFile, ifStatement.elseStatement!);
    if (!elseAssign) {
      return undefined;
    }

    // Compare left-hand sides structurally by printing
    const thenLhs = this.printer.printNode(ts.EmitHint.Unspecified, thenAssign.target, sourceFile);
    const elseLhs = this.printer.printNode(ts.EmitHint.Unspecified, elseAssign.target, sourceFile);
    if (thenLhs.replace(/\s+/g, '') !== elseLhs.replace(/\s+/g, '')) {
      return undefined;
    }

    const conditional = ts.factory.createConditionalExpression(
      ifStatement.expression,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      thenAssign.value,
      ts.factory.createToken(ts.SyntaxKind.ColonToken),
      elseAssign.value,
    );

    const assignment = ts.factory.createBinaryExpression(
      thenAssign.target,
      ts.factory.createToken(ts.SyntaxKind.EqualsToken),
      conditional,
    );

    return ts.factory.createExpressionStatement(assignment);
  }

  private extractSimpleAssignment(
    sourceFile: ts.SourceFile,
    statement: ts.Statement,
  ): { target: ts.Expression; value: ts.Expression } | undefined {
    const tryExtract = (node: ts.Statement): { target: ts.Expression; value: ts.Expression } | undefined => {
      if (!ts.isExpressionStatement(node)) {
        return undefined;
      }
      const expr = node.expression;
      if (!ts.isBinaryExpression(expr)) {
        return undefined;
      }
      if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
        return undefined; // no compound assignments
      }
      return { target: expr.left, value: expr.right };
    };

    if (ts.isBlock(statement)) {
      if (statement.statements.length !== 1) {
        return undefined;
      }
      return tryExtract(statement.statements[0]);
    }

    return tryExtract(statement);
  }

  private normalizeJsxSelfClosingSpacing(text: string): string {
    return text.replace(/>\/>/g, ' />');
  }
}
