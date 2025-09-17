import type * as vscode from 'vscode';
import * as ts from 'typescript';

/**
 * Resolves the TypeScript script kind for the provided VS Code document.
 */
export class ScriptKindResolver {
  public resolve(document: vscode.TextDocument): ts.ScriptKind {
    const filename = document.fileName.toLowerCase();
    if (filename.endsWith('.tsx')) {
      return ts.ScriptKind.TSX;
    }
    if (filename.endsWith('.ts')) {
      return ts.ScriptKind.TS;
    }
    if (filename.endsWith('.jsx')) {
      return ts.ScriptKind.JSX;
    }
    if (filename.endsWith('.js')) {
      return ts.ScriptKind.JS;
    }

    switch (document.languageId) {
      case 'typescriptreact':
        return ts.ScriptKind.TSX;
      case 'javascriptreact':
        return ts.ScriptKind.JSX;
      case 'typescript':
        return ts.ScriptKind.TS;
      case 'javascript':
        return ts.ScriptKind.JS;
      default:
        return ts.ScriptKind.TSX;
    }
  }
}
