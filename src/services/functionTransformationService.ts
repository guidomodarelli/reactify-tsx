import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import {
  AnalyzeResult,
  AnalyzeResultFailure,
  AnalyzeResultSuccess,
  FunctionContext,
  FunctionKind,
  FunctionTransformationId,
  TransformationChoice,
  TransformationOptions,
  TransformationPlanFailure,
  TransformationPlanResult,
  TransformationPlanSuccess,
  TransformationWarning,
  VariableContext,
} from '../models/functionTransformation';
import {
  DECLARATION_MISSING_INITIALIZER_MESSAGE,
  EXPECTED_ARROW_INITIALIZER_MESSAGE,
  EXPECTED_FUNCTION_EXPRESSION_INITIALIZER_MESSAGE,
  FUNCTION_MISSING_IMPLEMENTATION_MESSAGE,
  FUNCTION_NAME_REQUIRED_MESSAGE,
  FUNCTION_UNSUPPORTED_MODIFIER_MESSAGE,
  GENERATOR_ARROW_UNSUPPORTED_MESSAGE,
  NO_FUNCTION_IN_SELECTION_MESSAGE,
  NOT_AN_ARROW_FUNCTION_MESSAGE,
  NOT_A_FUNCTION_EXPRESSION_MESSAGE,
  NOT_A_FUNCTION_DECLARATION_MESSAGE,
  NOT_IN_VARIABLE_DECLARATION_MESSAGE,
  ONLY_ANONYMOUS_FUNCTION_SUPPORTED_MESSAGE,
  ONLY_IDENTIFIER_DECLARATIONS_SUPPORTED_MESSAGE,
  TRANSFORMATION_NOT_IMPLEMENTED_MESSAGE,
} from '../constants/messages';

interface LocationResult {
  readonly context: FunctionContext;
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class FunctionTransformationService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public analyze(document: vscode.TextDocument, selection: vscode.Selection): AnalyzeResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);

    const located = this.locateFunctionContext(sourceFile, selectionStart, selectionEnd);
    if (!located) {
      return { success: false, message: NO_FUNCTION_IN_SELECTION_MESSAGE } satisfies AnalyzeResultFailure;
    }

    return {
      success: true,
      context: located.context,
      sourceFile,
    } satisfies AnalyzeResultSuccess;
  }

  public listAvailableTransformations(context: FunctionContext): readonly TransformationChoice[] {
    const transformations: TransformationChoice[] = [];

    switch (context.kind) {
      case 'arrow':
        if (this.canConvertVariableToDeclaration(context.variableContext)) {
          transformations.push({
            id: FunctionTransformationId.ArrowVariableToFunctionDeclaration,
            label: 'Arrow (variable) → Function declaration',
          });
        }
        transformations.push({
          id: FunctionTransformationId.ArrowToFunctionExpression,
          label: 'Arrow → Function expression',
        });
        break;
      case 'functionExpression':
        if (this.canConvertVariableToDeclaration(context.variableContext)) {
          transformations.push({
            id: FunctionTransformationId.FunctionExpressionVariableToFunctionDeclaration,
            label: 'Function expression (variable) → Function declaration',
          });
        }
        transformations.push({
          id: FunctionTransformationId.FunctionExpressionToArrow,
          label: 'Function expression → Arrow',
        });
        break;
      case 'functionDeclaration':
        transformations.push({
          id: FunctionTransformationId.FunctionDeclarationToArrowVariable,
          label: 'Function declaration → Arrow (variable)',
        });
        transformations.push({
          id: FunctionTransformationId.FunctionDeclarationToFunctionExpressionVariable,
          label: 'Function declaration → Function expression (variable)',
        });
        break;
      default:
        break;
    }

    return transformations;
  }

  public createTransformationPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    context: FunctionContext,
    transformationId: FunctionTransformationId,
    options?: TransformationOptions,
  ): TransformationPlanResult {
    switch (transformationId) {
      case FunctionTransformationId.ArrowToFunctionExpression:
        return this.transformArrowToFunctionExpression(document, sourceFile, context);
      case FunctionTransformationId.FunctionExpressionToArrow:
        return this.transformFunctionExpressionToArrow(document, sourceFile, context);
      case FunctionTransformationId.ArrowVariableToFunctionDeclaration:
        return this.transformVariableInitializerToFunctionDeclaration(document, sourceFile, context, 'arrow');
      case FunctionTransformationId.FunctionExpressionVariableToFunctionDeclaration:
        return this.transformVariableInitializerToFunctionDeclaration(document, sourceFile, context, 'functionExpression');
      case FunctionTransformationId.FunctionDeclarationToArrowVariable:
        return this.transformFunctionDeclarationToVariable(document, sourceFile, context, 'arrow', options);
      case FunctionTransformationId.FunctionDeclarationToFunctionExpressionVariable:
        return this.transformFunctionDeclarationToVariable(document, sourceFile, context, 'functionExpression', options);
      default:
        return { success: false, message: TRANSFORMATION_NOT_IMPLEMENTED_MESSAGE } satisfies TransformationPlanFailure;
    }
  }

  private locateFunctionContext(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): LocationResult | undefined {
    let bestMatch: ts.Node | undefined;

    const visit = (node: ts.Node) => {
      const nodeStart = node.getStart(sourceFile, true);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }

      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
        bestMatch = node;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (!bestMatch) {
      return undefined;
    }

    const functionNode = bestMatch as FunctionContext['node'];
    const kind = this.getFunctionKind(functionNode);
    const variableContext = this.buildVariableContext(functionNode);

    return {
      context: {
        kind,
        node: functionNode,
        variableContext,
      },
    } satisfies LocationResult;
  }

  private buildVariableContext(node: ts.Node): VariableContext | undefined {
    let current: ts.Node | undefined = node.parent;
    let declaration: ts.VariableDeclaration | undefined;
    let declarationList: ts.VariableDeclarationList | undefined;
    let statement: ts.VariableStatement | undefined;

    while (current) {
      if (!declaration && ts.isVariableDeclaration(current)) {
        declaration = current;
      }

      if (!declarationList && ts.isVariableDeclarationList(current)) {
        declarationList = current;
      }

      if (!statement && ts.isVariableStatement(current)) {
        statement = current;
      }

      if (declaration && declarationList && statement) {
        break;
      }

      current = current.parent;
    }

    if (!declaration || !declarationList || !statement) {
      return undefined;
    }

    const declarationIndex = declarationList.declarations.findIndex((item) => item === declaration);
    if (declarationIndex < 0) {
      return undefined;
    }

    return {
      declaration,
      declarationList,
      statement,
      declarationIndex,
    } satisfies VariableContext;
  }

  private getFunctionKind(node: FunctionContext['node']): FunctionKind {
    if (ts.isArrowFunction(node)) {
      return 'arrow';
    }

    if (ts.isFunctionExpression(node)) {
      return 'functionExpression';
    }

    return 'functionDeclaration';
  }

  private canConvertVariableToDeclaration(variableContext: VariableContext | undefined): boolean {
    if (!variableContext) {
      return false;
    }

    const { declaration, declarationList } = variableContext;

    if (!ts.isIdentifier(declaration.name)) {
      return false;
    }

    if (declarationList.declarations.length !== 1) {
      return false;
    }

    return true;
  }

  private transformArrowToFunctionExpression(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    context: FunctionContext,
  ): TransformationPlanResult {
    if (!ts.isArrowFunction(context.node)) {
      return { success: false, message: NOT_AN_ARROW_FUNCTION_MESSAGE } satisfies TransformationPlanFailure;
    }

    const arrow = context.node;
    const isAsync = arrow.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    const modifiers = isAsync ? [ts.factory.createToken(ts.SyntaxKind.AsyncKeyword)] : undefined;
    const body = ts.isBlock(arrow.body)
      ? arrow.body
      : ts.factory.createBlock([ts.factory.createReturnStatement(arrow.body)], true);

    const functionExpression = ts.factory.createFunctionExpression(
      modifiers,
      undefined,
      undefined,
      arrow.typeParameters,
      arrow.parameters,
      arrow.type,
      body,
    );

    const replacementText = printer.printNode(ts.EmitHint.Expression, functionExpression, sourceFile);
    const range = getRangeFromNode(document, sourceFile, arrow);

    return {
      success: true,
      plan: {
        edits: [
          {
            range,
            newText: replacementText,
          },
        ],
        warnings: this.detectBindingWarnings(arrow),
      },
    } satisfies TransformationPlanSuccess;
  }

  private transformFunctionExpressionToArrow(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    context: FunctionContext,
  ): TransformationPlanResult {
    if (!ts.isFunctionExpression(context.node)) {
      return { success: false, message: NOT_A_FUNCTION_EXPRESSION_MESSAGE } satisfies TransformationPlanFailure;
    }

    const fn = context.node;
    if (fn.asteriskToken) {
      return { success: false, message: GENERATOR_ARROW_UNSUPPORTED_MESSAGE } satisfies TransformationPlanFailure;
    }

    if (fn.name) {
      return { success: false, message: ONLY_ANONYMOUS_FUNCTION_SUPPORTED_MESSAGE } satisfies TransformationPlanFailure;
    }

    const modifiers = fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
      ? [ts.factory.createToken(ts.SyntaxKind.AsyncKeyword)]
      : undefined;

    const arrowBody = ts.isBlock(fn.body) ? ts.factory.createBlock(fn.body.statements, true) : fn.body;

    const arrowFunction = ts.factory.createArrowFunction(
      modifiers,
      fn.typeParameters,
      fn.parameters,
      fn.type,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      arrowBody,
    );

    const replacementText = printer.printNode(ts.EmitHint.Expression, arrowFunction, sourceFile);
    const range = getRangeFromNode(document, sourceFile, fn);

    const warnings = this.detectBindingWarnings(fn);

    return {
      success: true,
      plan: {
        edits: [
          {
            range,
            newText: replacementText,
          },
        ],
        warnings,
      },
    } satisfies TransformationPlanSuccess;
  }

  private transformVariableInitializerToFunctionDeclaration(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    context: FunctionContext,
    sourceKind: 'arrow' | 'functionExpression',
  ): TransformationPlanResult {
    const variableContext = context.variableContext;
    if (!variableContext) {
      return { success: false, message: NOT_IN_VARIABLE_DECLARATION_MESSAGE } satisfies TransformationPlanFailure;
    }

    if (!ts.isIdentifier(variableContext.declaration.name)) {
      return { success: false, message: ONLY_IDENTIFIER_DECLARATIONS_SUPPORTED_MESSAGE } satisfies TransformationPlanFailure;
    }

    const initializer = variableContext.declaration.initializer;
    if (!initializer) {
      return { success: false, message: DECLARATION_MISSING_INITIALIZER_MESSAGE } satisfies TransformationPlanFailure;
    }

    if (sourceKind === 'arrow' && !ts.isArrowFunction(initializer)) {
      return { success: false, message: EXPECTED_ARROW_INITIALIZER_MESSAGE } satisfies TransformationPlanFailure;
    }

    if (sourceKind === 'functionExpression' && !ts.isFunctionExpression(initializer)) {
      return { success: false, message: EXPECTED_FUNCTION_EXPRESSION_INITIALIZER_MESSAGE } satisfies TransformationPlanFailure;
    }

    const functionNode = initializer as ts.ArrowFunction | ts.FunctionExpression;

    const name = variableContext.declaration.name;

    const modifierLikes: ts.ModifierLike[] = [];
    if (variableContext.statement.modifiers) {
      modifierLikes.push(...variableContext.statement.modifiers);
    }

    const isAsync = functionNode.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    if (isAsync) {
      modifierLikes.push(ts.factory.createToken(ts.SyntaxKind.AsyncKeyword));
    }

    const body = ts.isBlock(functionNode.body)
      ? functionNode.body
      : ts.factory.createBlock([ts.factory.createReturnStatement(functionNode.body)], true);

    const functionDeclaration = ts.factory.createFunctionDeclaration(
      modifierLikes.length > 0 ? modifierLikes : undefined,
      functionNode.asteriskToken,
      name,
      functionNode.typeParameters,
      functionNode.parameters,
      functionNode.type,
      body,
    );

    const comments: ts.SynthesizedComment[] = [];
    const warnings: TransformationWarning[] = [];

    if (variableContext.declaration.type) {
      comments.push(this.createFixMeComment());
      warnings.push('types-review-required');
    }

    const bindingWarnings = this.detectBindingWarnings(functionNode);
    if (bindingWarnings) {
      warnings.push(...bindingWarnings);
    }

    const statementRange = getRangeFromNode(document, sourceFile, variableContext.statement);
    const replacementText = this.printWithComments(functionDeclaration, sourceFile, comments);

    return {
      success: true,
      plan: {
        edits: [
          {
            range: statementRange,
            newText: replacementText,
          },
        ],
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    } satisfies TransformationPlanSuccess;
  }

  private transformFunctionDeclarationToVariable(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    context: FunctionContext,
    targetKind: 'arrow' | 'functionExpression',
    options?: TransformationOptions,
  ): TransformationPlanResult {
    if (!ts.isFunctionDeclaration(context.node)) {
      return { success: false, message: NOT_A_FUNCTION_DECLARATION_MESSAGE } satisfies TransformationPlanFailure;
    }

    const declaration = context.node;
    const originalName = declaration.name;
    let identifier = originalName;
    let shouldAnnotateRename = false;

    if (!identifier) {
      if (!options?.desiredName) {
        return { success: false, message: FUNCTION_NAME_REQUIRED_MESSAGE } satisfies TransformationPlanFailure;
      }

      identifier = ts.factory.createIdentifier(options.desiredName);
      shouldAnnotateRename = options.addRenameFixme ?? false;
    }

    if (!declaration.body) {
      return { success: false, message: FUNCTION_MISSING_IMPLEMENTATION_MESSAGE } satisfies TransformationPlanFailure;
    }

    if (declaration.asteriskToken && targetKind === 'arrow') {
      return { success: false, message: GENERATOR_ARROW_UNSUPPORTED_MESSAGE } satisfies TransformationPlanFailure;
    }

    let hasExport = false;
    let hasDefault = false;
    let isAsync = false;
    let unsupportedModifier: ts.ModifierLike | undefined;

    for (const modifier of declaration.modifiers ?? []) {
      switch (modifier.kind) {
        case ts.SyntaxKind.ExportKeyword:
          hasExport = true;
          break;
        case ts.SyntaxKind.DefaultKeyword:
          hasDefault = true;
          break;
        case ts.SyntaxKind.AsyncKeyword:
          isAsync = true;
          break;
        default:
          unsupportedModifier = modifier;
          break;
      }
    }

    if (unsupportedModifier) {
      return {
        success: false,
        message: FUNCTION_UNSUPPORTED_MODIFIER_MESSAGE,
      } satisfies TransformationPlanFailure;
    }

    const asyncToken = isAsync ? [ts.factory.createToken(ts.SyntaxKind.AsyncKeyword)] : undefined;

    const initializer = targetKind === 'arrow'
      ? ts.factory.createArrowFunction(
          asyncToken,
          declaration.typeParameters,
          declaration.parameters,
          declaration.type,
          ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          declaration.body,
        )
      : ts.factory.createFunctionExpression(
          asyncToken,
          declaration.asteriskToken,
          undefined,
          declaration.typeParameters,
          declaration.parameters,
          declaration.type,
          declaration.body,
        );

    const variableDeclaration = ts.factory.createVariableDeclaration(identifier, undefined, undefined, initializer);
    const declarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);
    const variableModifiers = hasExport && !hasDefault
      ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : undefined;
    const variableStatement = ts.factory.createVariableStatement(variableModifiers, declarationList);

    if (shouldAnnotateRename) {
      ts.addSyntheticLeadingComment(
        variableStatement,
        ts.SyntaxKind.SingleLineCommentTrivia,
        ' FIXME: rename',
        true,
      );
    }

    const statements: ts.Statement[] = [variableStatement];

    if (hasDefault) {
      const exportDefault = ts.factory.createExportAssignment(undefined, false, identifier);
      statements.push(exportDefault);
    }

    const warnings = targetKind === 'arrow'
      ? this.detectBindingWarnings(declaration)
      : undefined;

    const replacementText = statements
      .map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile))
      .join('\n');

    const range = getRangeFromNode(document, sourceFile, declaration);

    return {
      success: true,
      plan: {
        edits: [
          {
            range,
            newText: replacementText,
          },
        ],
        warnings,
      },
    } satisfies TransformationPlanSuccess;
  }

  private detectBindingWarnings(fn: ts.FunctionLikeDeclaration): TransformationWarning[] | undefined {
    const usage = this.scanForBindingSensitiveUsage(fn);
    if (!usage) {
      return undefined;
    }

    return usage.usesBinding ? ['binding-change'] : undefined;
  }

  private scanForBindingSensitiveUsage(fn: ts.FunctionLikeDeclaration): { usesBinding: boolean } | undefined {
    const body = fn.body;
    if (!body) {
      return undefined;
    }

    let usesBinding = false;

    const visit = (node: ts.Node) => {
      if (usesBinding) {
        return;
      }

      if (node === fn) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isFunctionLike(node) && node !== fn) {
        return;
      }

      switch (node.kind) {
        case ts.SyntaxKind.ThisKeyword:
        case ts.SyntaxKind.SuperKeyword:
          usesBinding = true;
          return;
        default:
          if (ts.isIdentifier(node) && node.text === 'arguments') {
            usesBinding = true;
            return;
          }
      }

      ts.forEachChild(node, visit);
    };

    visit(body);

    return { usesBinding };
  }

  private printWithComments(node: ts.Node, sourceFile: ts.SourceFile, comments: ts.SynthesizedComment[]): string {
    if (comments.length > 0) {
      comments.forEach((comment) => {
        ts.addSyntheticLeadingComment(node, comment.kind, comment.text, comment.hasTrailingNewLine);
      });
    }

    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  }

  private createFixMeComment(): ts.SynthesizedComment {
    return {
      kind: ts.SyntaxKind.SingleLineCommentTrivia,
      text: ' FIXME: review types',
      hasTrailingNewLine: true,
      pos: -1,
      end: -1,
    } satisfies ts.SynthesizedComment;
  }
}
