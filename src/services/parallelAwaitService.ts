import * as vscode from "vscode";
import * as ts from "typescript";
import { ScriptKindResolver } from "../utils/scriptKindResolver";

export type ParallelAwaitPlanFailureReason = "not-found" | "unsupported";

export interface ParallelAwaitPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface ParallelAwaitPlanSuccess {
  readonly success: true;
  readonly plan: ParallelAwaitPlan;
}

export interface ParallelAwaitPlanFailure {
  readonly success: false;
  readonly reason: ParallelAwaitPlanFailureReason;
}

export type ParallelAwaitPlanResult = ParallelAwaitPlanSuccess | ParallelAwaitPlanFailure;

export class ParallelAwaitService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createPlan(document: vscode.TextDocument, selection: vscode.Selection): ParallelAwaitPlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const fullText = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      fullText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const selectionStart = Math.min(document.offsetAt(selection.start), document.offsetAt(selection.end));
    const selectionEnd = Math.max(document.offsetAt(selection.start), document.offsetAt(selection.end));

    const container = this.findEnclosingStatementContainer(sourceFile, selectionStart, selectionEnd);
    if (!container) {
      return { success: false, reason: "not-found" } satisfies ParallelAwaitPlanFailure;
    }

    const statementInfo = this.collectTargetStatements(sourceFile, container, selectionStart, selectionEnd);
    if (!statementInfo) {
      return { success: false, reason: "not-found" } satisfies ParallelAwaitPlanFailure;
    }

    if (statementInfo.partialOverlap) {
      return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
    }

    const { statements, indices } = statementInfo;
    if (statements.length < 2) {
      return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
    }

    const firstIndex = indices[0];
    for (let i = 1; i < indices.length; i += 1) {
      if (indices[i] !== indices[i - 1] + 1) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }
    }

    const analysis = this.analyseStatements(sourceFile, statements, fullText);
    if (!analysis.success) {
      return { success: false, reason: analysis.reason } satisfies ParallelAwaitPlanFailure;
    }

    const rangeStart = statements[0].getStart(sourceFile);
    const rangeEnd = statements[statements.length - 1].getEnd();
    const range = new vscode.Range(document.positionAt(rangeStart), document.positionAt(rangeEnd));

    const newText = this.buildReplacementText(document, fullText, range, analysis);

    return {
      success: true,
      plan: { range, newText },
    } satisfies ParallelAwaitPlanSuccess;
  }

  private findEnclosingStatementContainer(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.Block | ts.SourceFile | undefined {
    let bestMatch: ts.Block | ts.SourceFile | undefined;

    const visit = (node: ts.Node) => {
      if (!this.nodeContainsRange(sourceFile, node, selectionStart, selectionEnd)) {
        return;
      }

      if (ts.isBlock(node) || ts.isSourceFile(node)) {
        if (!bestMatch) {
          bestMatch = node;
        } else {
          const currentSpan = bestMatch.getEnd() - bestMatch.getStart(sourceFile);
          const candidateSpan = node.getEnd() - node.getStart(sourceFile);
          if (candidateSpan < currentSpan) {
            bestMatch = node;
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return bestMatch;
  }

  private collectTargetStatements(
    sourceFile: ts.SourceFile,
    container: ts.Block | ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): { statements: ts.Statement[]; indices: number[]; partialOverlap: boolean } | undefined {
    const statements: ts.Statement[] = [];
    const indices: number[] = [];
    let partialOverlap = false;

    container.statements.forEach((statement, index) => {
      const statementStart = statement.getStart(sourceFile);
      const statementEnd = statement.getEnd();

      const fullyInside = selectionStart <= statementStart && selectionEnd >= statementEnd;
      const overlaps = selectionStart < statementEnd && selectionEnd > statementStart;

      if (fullyInside) {
        statements.push(statement);
        indices.push(index);
      } else if (overlaps) {
        partialOverlap = true;
      }
    });

    if (statements.length === 0) {
      return undefined;
    }

    return { statements, indices, partialOverlap };
  }

  private analyseStatements(
    sourceFile: ts.SourceFile,
    statements: ts.Statement[],
    fullText: string,
  ): { success: false; reason: ParallelAwaitPlanFailureReason } | {
    success: true;
    declarationKind: "const" | "let";
    identifiers: string[];
    expressions: string[];
  } {
    let declarationKind: "const" | "let" | undefined;
    const identifiers: string[] = [];
    const expressions: string[] = [];

    for (const statement of statements) {
      if (!ts.isVariableStatement(statement)) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      const declarationList = statement.declarationList;
      const isConst = (declarationList.flags & ts.NodeFlags.Const) !== 0;
      const isLet = (declarationList.flags & ts.NodeFlags.Let) !== 0;

      if (!isConst && !isLet) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      const currentKind: "const" | "let" = isConst ? "const" : "let";
      if (!declarationKind) {
        declarationKind = currentKind;
      } else if (declarationKind !== currentKind) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      if (declarationList.declarations.length !== 1) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      const declaration = declarationList.declarations[0];
      if (!ts.isIdentifier(declaration.name)) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      if (declaration.type) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      if (!declaration.initializer || !ts.isAwaitExpression(declaration.initializer)) {
        return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
      }

      const identifier = declaration.name.text;
      const expression = fullText.slice(
        declaration.initializer.expression.getStart(sourceFile),
        declaration.initializer.expression.getEnd(),
      ).trim();

      identifiers.push(identifier);
      expressions.push(expression);
    }

    if (!declarationKind) {
      return { success: false, reason: "unsupported" } satisfies ParallelAwaitPlanFailure;
    }

    return { success: true, declarationKind, identifiers, expressions };
  }

  private buildReplacementText(
    document: vscode.TextDocument,
    fullText: string,
    range: vscode.Range,
    analysis: { declarationKind: "const" | "let"; identifiers: string[]; expressions: string[] },
  ): string {
    const lineEnding = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
    const leadingIndent = document.getText(new vscode.Range(
      new vscode.Position(range.start.line, 0),
      range.start,
    ));
    const innerIndent = `${leadingIndent}    `;

    const expressionLines = analysis.expressions.map((expression, index) => {
      const suffix = index < analysis.expressions.length - 1 ? "," : "";
      return `${innerIndent}${expression}${suffix}`;
    });

    const lines = [
      `${analysis.declarationKind} [${analysis.identifiers.join(", ")}] = await Promise.all([`,
      ...expressionLines,
      `${leadingIndent}]);`,
    ];

    let newText = lines.join(lineEnding);

    const originalText = fullText.slice(
      document.offsetAt(range.start),
      document.offsetAt(range.end),
    );

    if (originalText.endsWith(lineEnding)) {
      newText += lineEnding;
    }

    return newText;
  }

  private nodeContainsRange(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    selectionStart: number,
    selectionEnd: number,
  ): boolean {
    const nodeStart = node.getStart(sourceFile);
    const nodeEnd = node.getEnd();
    return selectionStart >= nodeStart && selectionEnd <= nodeEnd;
  }
}