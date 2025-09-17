import * as ts from 'typescript';
import { attributeEventTypeMap, htmlElementTypeMap } from '../constants/reactEventTypes';

/**
 * Provides React synthetic event typings for JSX attributes when possible.
 */
export class ReactEventTypeResolver {
  public inferEventType(attribute: ts.JsxAttribute, sourceFile: ts.SourceFile): string | undefined {
    const attributeName = attribute.name.getText(sourceFile);
    const mapping = attributeEventTypeMap[attributeName];
    if (!mapping) {
      return undefined;
    }

    const elementType = this.findHtmlElementType(attribute, sourceFile) ?? mapping.defaultElement ?? 'Element';
    return `${mapping.reactType}<${elementType}>`;
  }

  private findHtmlElementType(attribute: ts.JsxAttribute, sourceFile: ts.SourceFile): string | undefined {
    const attributesParent = attribute.parent;
    if (!attributesParent) {
      return undefined;
    }

    const jsxParent = attributesParent.parent;
    if (ts.isJsxOpeningElement(jsxParent) || ts.isJsxSelfClosingElement(jsxParent)) {
      const tagName = jsxParent.tagName.getText(sourceFile);
      if (/^[a-z]/.test(tagName)) {
        const lowerCaseTag = tagName.toLowerCase();
        return htmlElementTypeMap[lowerCaseTag] ?? 'HTMLElement';
      }
    }

    return undefined;
  }
}
