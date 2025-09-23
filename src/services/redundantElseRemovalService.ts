import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type RedundantElseRemovalFailureReason = 'not-found' | 'no-else' | 'not-redundant' | 'unsupported';

export interface RedundantElseRemovalPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface RedundantElseRemovalPlanSuccess {
  readonly success: true;
  readonly plan: RedundantElseRemovalPlan;
}

export interface RedundantElseRemovalPlanFailure {
  readonly success: false;
  readonly reason: RedundantElseRemovalFailureReason;
}

export type RedundantElseRemovalPlanResult =
  | RedundantElseRemovalPlanSuccess
  | RedundantElseRemovalPlanFailure;

export class RedundantElseRemovalService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createRemovalPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): RedundantElseRemovalPlanResult {
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
    if (!ifStatement) {
      return { success: false, reason: 'not-found' } satisfies RedundantElseRemovalPlanFailure;
    }

    const elseStatement = ifStatement.elseStatement;
    if (!elseStatement) {
      return { success: false, reason: 'no-else' } satisfies RedundantElseRemovalPlanFailure;
    }

    if (ts.isIfStatement(elseStatement)) {
      return { success: false, reason: 'unsupported' } satisfies RedundantElseRemovalPlanFailure;
    }

    if (!this.isTerminalStatement(ifStatement.thenStatement)) {
      return { success: false, reason: 'not-redundant' } satisfies RedundantElseRemovalPlanFailure;
    }

    const hoistedStatements = this.collectHoistedStatements(elseStatement);
    const range = getRangeFromNode(document, sourceFile, ifStatement);
    const guardText = this.extractGuardText(document, sourceFile, ifStatement);

    if (hoistedStatements.length === 0) {
      return {
        success: true,
        plan: {
          range,
          newText: guardText,
        },
      } satisfies RedundantElseRemovalPlanSuccess;
    }

    const baseIndent = this.getBaseIndent(document, ifStatement);
    const hoistedText = this.renderHoistedStatements(document, sourceFile, hoistedStatements, baseIndent);

    const newText = `${guardText}\n\n${hoistedText}`;

    return {
      success: true,
      plan: {
        range,
        newText,
      },
    } satisfies RedundantElseRemovalPlanSuccess;
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

  private isTerminalStatement(statement: ts.Statement): boolean {
    if (
      ts.isReturnStatement(statement) ||
      ts.isThrowStatement(statement) ||
      ts.isContinueStatement(statement) ||
      ts.isBreakStatement(statement)
    ) {
      return true;
    }

    if (ts.isBlock(statement)) {
      if (statement.statements.length === 0) {
        return false;
      }
      const last = statement.statements[statement.statements.length - 1];
      return this.isTerminalStatement(last);
    }

    return false;
  }

  private collectHoistedStatements(elseStatement: ts.Statement): readonly ts.Statement[] {
    if (ts.isBlock(elseStatement)) {
      return Array.from(elseStatement.statements);
    }

    return [elseStatement];
  }

  private extractGuardText(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    ifStatement: ts.IfStatement,
  ): string {
    const guardStart = ifStatement.getStart(sourceFile);
    const guardEnd = ifStatement.thenStatement.getEnd();
    const raw = document.getText(
      new vscode.Range(document.positionAt(guardStart), document.positionAt(guardEnd)),
    );

    return this.trimTrailingWhitespace(raw);
  }

  private getBaseIndent(document: vscode.TextDocument, ifStatement: ts.IfStatement): string {
    const line = document.positionAt(ifStatement.getStart()).line;
    const text = document.lineAt(line).text;
    const match = text.match(/^\s*/);
    return match ? match[0] : '';
  }

  private renderHoistedStatements(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    statements: readonly ts.Statement[],
    baseIndent: string,
  ): string {
    return statements
      .map((statement) => this.renderStatement(document, sourceFile, statement, baseIndent))
      .join('\n');
  }

  private renderStatement(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    statement: ts.Statement,
    baseIndent: string,
  ): string {
    const start = statement.getStart(sourceFile);
    const end = statement.getEnd();
    const raw = document
      .getText(new vscode.Range(document.positionAt(start), document.positionAt(end)))
      .replace(/\r\n/g, '\n');

    const lines = raw.split('\n');
    this.trimEmptyEdges(lines);

    if (lines.length === 0) {
      return baseIndent;
    }

    const commonIndentLength = this.computeCommonIndentLength(lines);

    const adjusted = lines.map((line) => {
      const withoutTrailing = line.replace(/[ \t]+$/, '');
      if (withoutTrailing.trim().length === 0) {
        return '';
      }
      const removal = Math.min(commonIndentLength, this.countLeadingWhitespace(withoutTrailing));
      const content = withoutTrailing.slice(removal);
      return content.length === 0 ? '' : baseIndent + content;
    });

    return adjusted.join('\n').replace(/[ \t]+$/gm, '');
  }

  private trimTrailingWhitespace(text: string): string {
    const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ''));
    while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
      lines.pop();
    }
    return lines.join('\n');
  }

  private trimEmptyEdges(lines: string[]): void {
    while (lines.length > 0 && lines[0].trim().length === 0) {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
      lines.pop();
    }
  }

  private computeCommonIndentLength(lines: string[]): number {
    let common = Number.POSITIVE_INFINITY;
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      const length = this.countLeadingWhitespace(line);
      if (length < common) {
        common = length;
      }
    }

    return Number.isFinite(common) ? common : 0;
  }

  private countLeadingWhitespace(text: string): number {
    let count = 0;
    for (const char of text) {
      if (char === ' ' || char === '\t') {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  }
}
