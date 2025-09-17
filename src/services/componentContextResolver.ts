import * as ts from 'typescript';
import type { ComponentContext, FunctionComponentContext, ClassComponentContext } from '../models/componentContext';

/**
 * Resolves the React component context (function or class) that contains a given JSX attribute.
 */
export class ComponentContextResolver {
  public resolve(attribute: ts.JsxAttribute): ComponentContext | undefined {
    let current: ts.Node | undefined = attribute;

    while (current) {
      if (ts.isClassLike(current)) {
        const member = this.findContainingMember(current, attribute);
        if (!member) {
          return undefined;
        }
        return this.toClassComponentContext(current, member);
      }

      if (this.isComponentFunctionLike(current)) {
        const functionNode = current as ts.FunctionLikeDeclaration;
        const block = functionNode.body && ts.isBlock(functionNode.body) ? functionNode.body : undefined;
        return this.toFunctionComponentContext(functionNode, block);
      }

      current = current.parent;
    }

    return undefined;
  }

  private toClassComponentContext(
    classNode: ts.ClassLikeDeclaration,
    containingMember: ts.ClassElement,
  ): ClassComponentContext {
    return {
      kind: 'class',
      classNode,
      containingMember,
    };
  }

  private toFunctionComponentContext(
    functionNode: ts.FunctionLikeDeclaration,
    block: ts.Block | undefined,
  ): FunctionComponentContext {
    return {
      kind: 'function',
      functionNode,
      block,
    };
  }

  private isComponentFunctionLike(node: ts.Node): boolean {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    );
  }

  private findContainingMember(
    classNode: ts.ClassLikeDeclaration,
    inner: ts.Node,
  ): ts.ClassElement | undefined {
    return classNode.members.find((member) => inner.pos >= member.pos && inner.end <= member.end);
  }
}
