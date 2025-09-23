import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type StringSplitMergePlanFailureReason = 'not-found' | 'unsupported';

export interface StringSplitMergePlan {
  readonly range: vscode.Range;
  readonly newText: string;
  readonly mode: 'split' | 'merge';
}

export interface StringSplitMergePlanSuccess {
  readonly success: true;
  readonly plan: StringSplitMergePlan;
}

export interface StringSplitMergePlanFailure {
  readonly success: false;
  readonly reason: StringSplitMergePlanFailureReason;
}

export type StringSplitMergePlanResult = StringSplitMergePlanSuccess | StringSplitMergePlanFailure;

export class StringSplitMergeService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createPlan(document: vscode.TextDocument, selection: vscode.Selection): StringSplitMergePlanResult {
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

    // 1) Try split-at-caret inside a simple string literal (single or double quotes).
    const splitPlan = this.tryCreateSplitPlan(document, sourceFile, selectionStart, selectionEnd);
    if (splitPlan) {
      return splitPlan;
    }

    // 2) Try merge of adjacent string literals connected by "+".
    const mergePlan = this.tryCreateMergePlan(document, sourceFile, selectionStart, selectionEnd);
    if (mergePlan) {
      return mergePlan;
    }

    return { success: false, reason: 'not-found' } satisfies StringSplitMergePlanFailure;
  }

  private tryCreateSplitPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): StringSplitMergePlanResult | undefined {
    if (selectionStart !== selectionEnd) {
      return undefined; // split only on caret
    }

    let match: ts.StringLiteral | undefined;
    const visit = (node: ts.Node) => {
      if (match) return;
      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) return;
      if (ts.isStringLiteral(node)) {
        match = node;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (!match) return undefined;

    // Determine exact quotes and bounds using source text to preserve escapes verbatim.
    const literalStart = match.getStart(sourceFile); // index of opening quote
    const literalEnd = match.getEnd(); // index after closing quote
    const contentStart = literalStart + 1;
    const contentEnd = literalEnd - 1;

    // Caret must be inside content (not on quotes) and not at boundaries.
    if (selectionStart <= contentStart || selectionStart >= contentEnd) {
      return { success: false, reason: 'unsupported' } satisfies StringSplitMergePlanFailure;
    }

    const fullText = document.getText();
    const quoteChar = fullText[literalStart];
    if (quoteChar !== '\'' && quoteChar !== '"') {
      // For minimal implementation, ignore templates/backticks.
      return { success: false, reason: 'unsupported' } satisfies StringSplitMergePlanFailure;
    }

    const leftContent = fullText.slice(contentStart, selectionStart);
    const rightContent = fullText.slice(selectionStart, contentEnd);
    const leftLiteral = `${quoteChar}${leftContent}${quoteChar}`;
    const rightLiteral = `${quoteChar}${rightContent}${quoteChar}`;
    const newText = `${leftLiteral} + ${rightLiteral}`;

    const range = getRangeFromNode(document, sourceFile, match);
    return { success: true, plan: { range, newText, mode: 'split' } } satisfies StringSplitMergePlanSuccess;
  }

  private tryCreateMergePlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): StringSplitMergePlanResult | undefined {
    // Find the smallest BinaryExpression covering the selection.
    let target: ts.BinaryExpression | undefined;
    const visit = (node: ts.Node) => {
      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) return; // selection outside node
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        target = node;
        // keep searching children to find smallest enclosing
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (!target) return undefined;

    // Flatten a + b + c chain.
    const parts: ts.Expression[] = [];
    const collect = (expr: ts.Expression) => {
      if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        collect(expr.left);
        collect(expr.right);
      } else {
        parts.push(expr);
      }
    };
    collect(target);

    if (parts.length < 2 || !parts.every(p => ts.isStringLiteral(p))) {
      return { success: false, reason: 'unsupported' } satisfies StringSplitMergePlanFailure;
    }

    const fullText = document.getText();
    // Ensure consistent quote style by taking it from the first literal in source.
    const first = parts[0] as ts.StringLiteral;
    const firstStart = first.getStart(sourceFile);
    const quoteChar = fullText[firstStart];
    if (quoteChar !== '\'' && quoteChar !== '"') {
      return { success: false, reason: 'unsupported' } satisfies StringSplitMergePlanFailure;
    }

    // Ensure all literals use the same quote style for minimal implementation.
    const sameQuotes = parts.every(p => fullText[(p as ts.StringLiteral).getStart(sourceFile)] === quoteChar);
    if (!sameQuotes) {
      return { success: false, reason: 'unsupported' } satisfies StringSplitMergePlanFailure;
    }

    const contents = parts.map(p => {
      const start = (p as ts.StringLiteral).getStart(sourceFile) + 1;
      const end = (p as ts.StringLiteral).getEnd() - 1;
      return fullText.slice(start, end);
    });
    const merged = `${quoteChar}${contents.join('')}${quoteChar}`;

    // Replace the entire chain range.
    const chainStart = (parts[0] as ts.StringLiteral).getStart(sourceFile);
    const chainEnd = (parts[parts.length - 1] as ts.StringLiteral).getEnd();
    const range = new vscode.Range(document.positionAt(chainStart), document.positionAt(chainEnd));

    return { success: true, plan: { range, newText: merged, mode: 'merge' } } satisfies StringSplitMergePlanSuccess;
  }
}

