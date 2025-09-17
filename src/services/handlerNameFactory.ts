import type * as vscode from 'vscode';
import * as ts from 'typescript';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import type { ComponentContext } from '../models/componentContext';

/**
 * Computes handler names that are unique within the component scope.
 */
export class HandlerNameFactory {
  public createHandlerName(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    attribute: ts.JsxAttribute,
    componentContext: ComponentContext,
  ): string {
    const attributeName = attribute.name.getText(sourceFile);
    const baseName = this.buildHandlerBaseName(attributeName);
    const componentRange = this.getComponentRange(document, sourceFile, componentContext);
    const componentText = document.getText(componentRange);

    let candidate = baseName;
    let index = 2;
    const createDuplicateRegex = () => new RegExp(`\\b${candidate}\\b`);

    while (createDuplicateRegex().test(componentText)) {
      candidate = `${baseName}${index}`;
      index += 1;
    }

    return candidate;
  }

  private getComponentRange(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    componentContext: ComponentContext,
  ): vscode.Range {
    if (componentContext.kind === 'function') {
      return getRangeFromNode(document, sourceFile, componentContext.functionNode);
    }

    return getRangeFromNode(document, sourceFile, componentContext.classNode);
  }

  private buildHandlerBaseName(attributeName: string): string {
    if (/^on[A-Z]/.test(attributeName)) {
      return `handle${attributeName.slice(2)}`;
    }

    const capitalized = attributeName.replace(/^[a-z]/, (char) => char.toUpperCase());
    return capitalized ? `handle${capitalized}` : 'handleEvent';
  }
}
