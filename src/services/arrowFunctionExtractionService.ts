import type * as vscode from 'vscode';
import * as ts from 'typescript';
import type { ArrowFunctionExtractionPlan, ComponentContext } from '../models/componentContext';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { ArrowFunctionLocator } from './arrowFunctionLocator';
import { ComponentContextResolver } from './componentContextResolver';
import { HandlerNameFactory } from './handlerNameFactory';
import { ParameterTextBuilder } from './parameterTextBuilder';
import { ArrowBodyBuilder } from './arrowBodyBuilder';
import { InsertionPlanner } from './insertionPlanner';
import {
  INSERTION_TARGET_ERROR_MESSAGE,
  MISSING_COMPONENT_CONTEXT_MESSAGE,
  SELECT_ARROW_FUNCTION_MESSAGE,
  UNSUPPORTED_COMPONENT_CONTEXT_MESSAGE,
} from '../constants/messages';

export interface ExtractionError {
  readonly success: false;
  readonly message: string;
}

export interface ExtractionSuccess {
  readonly success: true;
  readonly plan: ArrowFunctionExtractionPlan;
}

export type ExtractionResult = ExtractionSuccess | ExtractionError;

/**
 * Orchestrates the arrow function extraction process and produces the required edit plan.
 */
export class ArrowFunctionExtractionService {
  public constructor(
    private readonly scriptKindResolver: ScriptKindResolver,
    private readonly arrowFunctionLocator: ArrowFunctionLocator,
    private readonly componentContextResolver: ComponentContextResolver,
    private readonly handlerNameFactory: HandlerNameFactory,
    private readonly parameterTextBuilder: ParameterTextBuilder,
    private readonly arrowBodyBuilder: ArrowBodyBuilder,
    private readonly insertionPlanner: InsertionPlanner,
  ) {}

  public createExtractionPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    editorOptions: vscode.TextEditorOptions | undefined,
  ): ExtractionResult {
    const sourceText = document.getText();
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceFile = ts.createSourceFile(document.fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    const arrowContext = this.arrowFunctionLocator.locate(sourceFile, selectionStart, selectionEnd);

    if (!arrowContext) {
      return { success: false, message: SELECT_ARROW_FUNCTION_MESSAGE };
    }

    const componentContext = this.componentContextResolver.resolve(arrowContext.attribute);
    if (!componentContext) {
      return { success: false, message: MISSING_COMPONENT_CONTEXT_MESSAGE };
    }

    if (!this.isSupportedFunctionContext(componentContext)) {
      return { success: false, message: UNSUPPORTED_COMPONENT_CONTEXT_MESSAGE };
    }

    const handlerName = this.handlerNameFactory.createHandlerName(document, sourceFile, arrowContext.attribute, componentContext);
    const parameterText = this.parameterTextBuilder.buildParametersText(document, sourceFile, arrowContext.arrow, arrowContext.attribute);
    const bodyDetails = this.arrowBodyBuilder.buildBodyText(document, sourceFile, arrowContext.arrow);

    const replacementText = componentContext.kind === 'class' ? `this.${handlerName}` : handlerName;
    const arrowRange = getRangeFromNode(document, sourceFile, arrowContext.arrow);

    const handlerInsertion = this.insertionPlanner.planInsertion(
      document,
      sourceFile,
      arrowContext.arrow,
      componentContext,
      handlerName,
      parameterText,
      bodyDetails,
      editorOptions,
    );

    if (!handlerInsertion) {
      return { success: false, message: INSERTION_TARGET_ERROR_MESSAGE };
    }

    return {
      success: true,
      plan: {
        handlerName,
        replacementText,
        arrowRange,
        handlerInsertion,
      },
    };
  }

  private isSupportedFunctionContext(componentContext: ComponentContext): boolean {
    if (componentContext.kind === 'function' && !componentContext.block) {
      return false;
    }

    return true;
  }
}
