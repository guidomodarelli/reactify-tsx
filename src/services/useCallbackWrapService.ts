import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import {
  type UseCallbackWrapPlanResult,
  type UseCallbackWrapPlanSuccess,
  type UseCallbackWrapPlanFailure,
  type UseCallbackWrapEdit,
} from '../models/useCallbackWrap';

interface LocatedInitializerContext {
  readonly declaration: ts.VariableDeclaration;
  readonly declarationList: ts.VariableDeclarationList;
  readonly functionExpression: ts.ArrowFunction | ts.FunctionExpression;
}

type LocateResult =
  | { readonly kind: 'success'; readonly context: LocatedInitializerContext }
  | { readonly kind: 'already-wrapped' }
  | undefined;

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class UseCallbackWrapService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createPlan(document: vscode.TextDocument, selection: vscode.Selection): UseCallbackWrapPlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const content = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, content, ts.ScriptTarget.Latest, true, scriptKind);

    const selectionStart = Math.min(document.offsetAt(selection.start), document.offsetAt(selection.end));
    const selectionEnd = Math.max(document.offsetAt(selection.start), document.offsetAt(selection.end));

    const located = this.locateInitializer(sourceFile, selectionStart, selectionEnd);
    if (!located) {
      return this.failure('not-found');
    }

    if (located.kind === 'already-wrapped') {
      return this.failure('already-wrapped');
    }

    const { declaration, declarationList, functionExpression } = located.context;

    if (!ts.isIdentifier(declaration.name)) {
      return this.failure('unsupported');
    }

    if (declarationList.declarations.length !== 1) {
      return this.failure('unsupported');
    }

    const declarationFlags = declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let);
    if (declarationFlags === 0) {
      return this.failure('unsupported');
    }

    const initializerRange = getRangeFromNode(document, sourceFile, functionExpression);
    const initializerText = document.getText(initializerRange);
    const wrappedText = `useCallback(${initializerText}, [])`;

    const edits: UseCallbackWrapEdit[] = [
      { range: initializerRange, newText: wrappedText },
    ];

    const importEdit = this.createImportEdit(document, sourceFile);
    if (importEdit) {
      edits.push(importEdit);
    }

    return {
      success: true,
      plan: { edits },
    } satisfies UseCallbackWrapPlanSuccess;
  }

  private locateInitializer(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): LocateResult {
    let result: LocateResult;

    const visit = (node: ts.Node) => {
      if (result) {
        return;
      }

      if (ts.isVariableDeclaration(node) && node.initializer) {
        const outcome = this.evaluateVariableDeclaration(node, selectionStart, selectionEnd, sourceFile);
        if (outcome) {
          result = outcome;
          return;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
  }

  private evaluateVariableDeclaration(
    declaration: ts.VariableDeclaration,
    selectionStart: number,
    selectionEnd: number,
    sourceFile: ts.SourceFile,
  ): LocateResult {
    const initializer = declaration.initializer;
    if (!initializer) {
      return undefined;
    }

    const initializerStart = initializer.getStart(sourceFile);
    const initializerEnd = initializer.getEnd();
    const intersectsInitializer = selectionEnd >= initializerStart && selectionStart < initializerEnd;

    const strippedInitializer = this.unwrapParentheses(initializer);
    if (ts.isCallExpression(strippedInitializer) && this.isUseCallbackCall(strippedInitializer)) {
      const firstArg = strippedInitializer.arguments[0];
      if (firstArg && (ts.isArrowFunction(firstArg) || ts.isFunctionExpression(firstArg))) {
        const functionStart = firstArg.getStart(sourceFile);
        const functionEnd = firstArg.getEnd();
        const intersectsFunction = selectionEnd >= functionStart && selectionStart < functionEnd;
        if (intersectsFunction) {
          return { kind: 'already-wrapped' };
        }
      }

      return { kind: 'already-wrapped' };
    }

    if (!ts.isArrowFunction(strippedInitializer) && !ts.isFunctionExpression(strippedInitializer)) {
      return undefined;
    }

    const functionStart = strippedInitializer.getStart(sourceFile);
    const functionEnd = strippedInitializer.getEnd();
    const intersectsFunction = selectionEnd >= functionStart && selectionStart < functionEnd;

    // Accept caret over the variable name or the assignment region leading into the initializer.
    // This makes the refactor discoverable even when the caret sits on the left-hand side.
    const nameStart = declaration.name.getStart(sourceFile);
    const lhsRegionStart = nameStart;
    const lhsRegionEnd = functionStart; // up to the start of the initializer
    const intersectsLhs = selectionEnd >= lhsRegionStart && selectionStart < lhsRegionEnd;

    if (!intersectsFunction && !intersectsLhs && !intersectsInitializer) {
      return undefined;
    }

    const declarationList = declaration.parent;
    if (!ts.isVariableDeclarationList(declarationList)) {
      return undefined;
    }

    const parent = declarationList.parent;
    if (!ts.isVariableStatement(parent)) {
      return undefined;
    }

    return {
      kind: 'success',
      context: {
        declaration,
        declarationList,

        functionExpression: strippedInitializer,
      },
    };
  }

  private unwrapParentheses(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  private isUseCallbackCall(callExpression: ts.CallExpression): boolean {
    const callee = callExpression.expression;
    if (ts.isIdentifier(callee)) {
      return callee.text === 'useCallback';
    }

    if (ts.isPropertyAccessExpression(callee)) {
      return callee.name.text === 'useCallback';
    }

    return false;
  }

  private createImportEdit(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
  ): UseCallbackWrapEdit | undefined {
    const lineEnding = this.detectLineEnding(document);
    const imports = sourceFile.statements.filter((statement): statement is ts.ImportDeclaration => ts.isImportDeclaration(statement));
    const reactImport = imports.find((statement) => this.isReactModule(statement.moduleSpecifier));

    if (reactImport) {
      const importClause = reactImport.importClause;
      if (!importClause || importClause.isTypeOnly) {
        return this.buildStandaloneImportEdit(document, sourceFile, imports, reactImport, lineEnding);
      }

      const namedBindings = importClause.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        if (namedBindings.elements.some((element) => element.name.text === 'useCallback')) {
          return undefined;
        }

        const updatedElements = [...namedBindings.elements, this.createUseCallbackSpecifier()];
        const updatedNamed = ts.factory.updateNamedImports(namedBindings, updatedElements);
        const updatedClause = ts.factory.updateImportClause(importClause, importClause.isTypeOnly, importClause.name, updatedNamed);
        const updatedDeclaration = ts.factory.updateImportDeclaration(
          reactImport,
          reactImport.modifiers,
          updatedClause,
          reactImport.moduleSpecifier,
          reactImport.assertClause,
        );

        return this.buildReplacementEdit(document, sourceFile, reactImport, updatedDeclaration);
      }

      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        return this.buildStandaloneImportEdit(document, sourceFile, imports, reactImport, lineEnding);
      }

      if (!namedBindings) {
        const updatedClause = ts.factory.updateImportClause(
          importClause,
          importClause.isTypeOnly,
          importClause.name,
          ts.factory.createNamedImports([this.createUseCallbackSpecifier()]),
        );
        const updatedDeclaration = ts.factory.updateImportDeclaration(
          reactImport,
          reactImport.modifiers,
          updatedClause,
          reactImport.moduleSpecifier,
          reactImport.assertClause,
        );
        return this.buildReplacementEdit(document, sourceFile, reactImport, updatedDeclaration);
      }
    }

    return this.buildStandaloneImportEdit(document, sourceFile, imports, undefined, lineEnding);
  }

  private buildReplacementEdit(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    original: ts.ImportDeclaration,
    replacement: ts.ImportDeclaration,
  ): UseCallbackWrapEdit {
    const range = getRangeFromNode(document, sourceFile, original);
    let newText = printer.printNode(ts.EmitHint.Unspecified, replacement, sourceFile);
    const originalText = document.getText(range);
    const trailingMatch = /(\r?\n)+$/u.exec(originalText);
    if (trailingMatch) {
      newText += trailingMatch[0];
    }

    return { range, newText } satisfies UseCallbackWrapEdit;
  }

  private buildStandaloneImportEdit(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    imports: readonly ts.ImportDeclaration[],
    anchor: ts.ImportDeclaration | undefined,
    lineEnding: string,
  ): UseCallbackWrapEdit | undefined {
    const newImportText = `import { useCallback } from 'react';${lineEnding}`;
    const requiresTrailingBlank = imports.length === 0 && !anchor;
    const insertOffset = anchor
      ? anchor.getEnd()
      : imports.length > 0
        ? imports[0].getStart(sourceFile)
        : 0;

    const insertPosition = document.positionAt(insertOffset);

    let prefix = '';
    if (insertOffset > 0) {
      const precedingText = document.getText(new vscode.Range(
        document.positionAt(Math.max(0, insertOffset - 2)),
        insertPosition,
      ));
      if (!precedingText.endsWith('\n')) {
        prefix = lineEnding;
      }
    }

    let suffix = '';
    if (requiresTrailingBlank) {
      suffix = lineEnding;
    }

    const range = new vscode.Range(insertPosition, insertPosition);
    const newText = `${prefix}${newImportText}${suffix}`;
    return newText.length === 0 ? undefined : ({ range, newText } satisfies UseCallbackWrapEdit);
  }

  private isReactModule(moduleSpecifier: ts.Expression): boolean {
    return ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === 'react';
  }

  private createUseCallbackSpecifier(): ts.ImportSpecifier {
    return ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('useCallback'));
  }


  private detectLineEnding(document: vscode.TextDocument): string {
    return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  }

  private failure(reason: UseCallbackWrapPlanFailure['reason']): UseCallbackWrapPlanFailure {
    return { success: false, reason };
  }
}



export type { UseCallbackWrapPlanSuccess } from '../models/useCallbackWrap';
