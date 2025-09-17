import * as vscode from 'vscode';
import * as ts from 'typescript';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export interface ArrowBodyBuildResult {
  readonly kind: 'block' | 'expression';
  readonly text: string;
}

/**
 * Builds normalized body text for extracted arrow functions.
 */
export class ArrowBodyBuilder {
  public buildBodyText(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    arrow: ts.ArrowFunction,
  ): ArrowBodyBuildResult {
    if (ts.isBlock(arrow.body)) {
      const innerText = this.extractBlockInnerText(document, sourceFile, arrow.body);
      return { kind: 'block', text: innerText };
    }

    const expression = document.getText(getRangeFromNode(document, sourceFile, arrow.body));
    return { kind: 'expression', text: expression };
  }

  private extractBlockInnerText(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    block: ts.Block,
  ): string {
    const start = block.getStart(sourceFile) + 1;
    const end = block.getEnd() - 1;
    if (end <= start) {
      return '';
    }

    return document.getText(new vscode.Range(document.positionAt(start), document.positionAt(end)));
  }
}
