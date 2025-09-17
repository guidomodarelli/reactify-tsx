import type * as vscode from 'vscode';

/**
 * Provides indentation utilities based on the current editor configuration.
 */
export class IndentationService {
  /**
   * Returns the indentation string for the specified line in the document.
   */
  public getLineIndent(document: vscode.TextDocument, line: number): string {
    if (line < 0 || line >= document.lineCount) {
      return '';
    }
    const match = document.lineAt(line).text.match(/^\s*/);
    return match ? match[0] : '';
  }

  /**
   * Determines the indent unit (tabs or spaces) based on the provided editor options.
   */
  public resolveIndentUnit(options: vscode.TextEditorOptions | undefined): string {
    const tabSize = typeof options?.tabSize === 'number' ? options.tabSize : 2;
    const insertSpaces = options?.insertSpaces !== false;
    return insertSpaces ? ' '.repeat(Math.max(1, tabSize)) : '\t';
  }
}
