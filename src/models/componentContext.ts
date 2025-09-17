import type * as ts from 'typescript';

/** Captures the arrow function and surrounding JSX attribute used as extraction anchor. */
export interface ArrowFunctionContext {
  readonly arrow: ts.ArrowFunction;
  readonly attribute: ts.JsxAttribute;
}

/** Represents a function component that encloses the arrow function. */
export interface FunctionComponentContext {
  readonly kind: 'function';
  readonly functionNode: ts.FunctionLikeDeclaration;
  readonly block: ts.Block | undefined;
}

/** Represents a class component that encloses the arrow function. */
export interface ClassComponentContext {
  readonly kind: 'class';
  readonly classNode: ts.ClassLikeDeclaration;
  readonly containingMember: ts.ClassElement;
}

export type ComponentContext = FunctionComponentContext | ClassComponentContext;

/** Describes where and how the generated handler should be inserted within the component. */
export interface HandlerInsertionPlan {
  readonly insertPosition: import('vscode').Position;
  readonly insertText: string;
  readonly handlerDefinitionOffset?: number;
}

/** Fully describes the edits required to extract the arrow function into a handler. */
export interface ArrowFunctionExtractionPlan {
  readonly handlerName: string;
  readonly replacementText: string;
  readonly arrowRange: import('vscode').Range;
  readonly handlerInsertion: HandlerInsertionPlan;
}
