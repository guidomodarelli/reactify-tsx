import * as vscode from 'vscode';
import type * as ts from 'typescript';

/**
 * Converts a TypeScript AST node into the corresponding VS Code range.
 */
export function getRangeFromNode(
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile,
  node: ts.Node,
): vscode.Range {
  return new vscode.Range(
    document.positionAt(node.getStart(sourceFile)),
    document.positionAt(node.getEnd()),
  );
}
