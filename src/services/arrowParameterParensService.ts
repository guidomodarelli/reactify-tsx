import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type ArrowParameterParensPlanFailureReason = 'not-found' | 'unsupported' | 'already-parenthesized';

export interface ArrowParameterParensPlan {
  readonly range: vscode.Range;
  readonly newText: string;
}

export interface ArrowParameterParensPlanSuccess {
  readonly success: true;
  readonly plan: ArrowParameterParensPlan;
}

export interface ArrowParameterParensPlanFailure {
  readonly success: false;
  readonly reason: ArrowParameterParensPlanFailureReason;
}

export type ArrowParameterParensPlanResult = ArrowParameterParensPlanSuccess | ArrowParameterParensPlanFailure;

export class ArrowParameterParensService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createAddParensPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): ArrowParameterParensPlanResult {
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
      return { success: false, reason: 'not-found' } satisfies ArrowParameterParensPlanFailure;
    }

    if (arrow.parameters.length !== 1) {
      return { success: false, reason: 'unsupported' } satisfies ArrowParameterParensPlanFailure;
    }

    const parameter = arrow.parameters[0];
    if (!ts.isIdentifier(parameter.name)) {
      return { success: false, reason: 'unsupported' } satisfies ArrowParameterParensPlanFailure;
    }

    // Disallow cases that already have parentheses: check nearest non-space chars around parameter
    const paramRange = getRangeFromNode(document, sourceFile, parameter);
    const paramStart = document.offsetAt(paramRange.start);
    const paramEnd = document.offsetAt(paramRange.end);

    const hasParens = this.hasParenthesesAround(sourceText, paramStart, paramEnd);
    if (hasParens) {
      return { success: false, reason: 'already-parenthesized' } satisfies ArrowParameterParensPlanFailure;
    }

    const originalText = document.getText(paramRange);
    const replacement = `(${originalText})`;

    return {
      success: true,
      plan: {
        range: paramRange,
        newText: replacement,
      },
    } satisfies ArrowParameterParensPlanSuccess;
  }

  private hasParenthesesAround(text: string, start: number, end: number): boolean {
    let left = start - 1;
    while (left >= 0 && /\s/.test(text[left])) {
      left -= 1;
    }
    let right = end;
    while (right < text.length && /\s/.test(text[right])) {
      right += 1;
    }
    return text[left] === '(' && text[right] === ')';
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

