import * as ts from 'typescript';
import type { ArrowFunctionContext } from '../models/componentContext';

/**
 * Locates an arrow function within the selection that belongs to a JSX attribute.
 */
export class ArrowFunctionLocator {
  public locate(
    sourceFile: ts.SourceFile,
    startOffset: number,
    endOffset: number,
  ): ArrowFunctionContext | undefined {
    const rangeStart = Math.min(startOffset, endOffset);
    const rangeEnd = Math.max(startOffset, endOffset);
    let result: ArrowFunctionContext | undefined;

    const visit = (node: ts.Node) => {
      if (result) {
        return;
      }

      if (rangeStart < node.getStart(sourceFile) || rangeEnd > node.getEnd()) {
        return;
      }

      if (ts.isArrowFunction(node)) {
        const attribute = this.findParentJsxAttribute(node);
        if (attribute) {
          result = { arrow: node, attribute };
          return;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
  }

  private findParentJsxAttribute(node: ts.Node): ts.JsxAttribute | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isJsxAttribute(current)) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }
}
