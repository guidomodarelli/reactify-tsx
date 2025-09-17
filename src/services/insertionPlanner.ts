import type * as vscode from 'vscode';
import * as ts from 'typescript';
import type { ComponentContext, HandlerInsertionPlan } from '../models/componentContext';
import type { ArrowBodyBuildResult } from './arrowBodyBuilder';
import { normalizeBlockBody } from '../utils/textNormalization';
import { IndentationService } from '../utils/indentationService';

/**
 * Plans where and how the extracted handler should be inserted based on the component type.
 */
export class InsertionPlanner {
  public constructor(private readonly indentationService: IndentationService) {}

  public planInsertion(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    arrow: ts.ArrowFunction,
    componentContext: ComponentContext,
    handlerName: string,
    parameterText: string,
    body: ArrowBodyBuildResult,
    editorOptions: vscode.TextEditorOptions | undefined,
  ): HandlerInsertionPlan | undefined {
    const paramsWrapped = parameterText ? `(${parameterText})` : '()';

    if (componentContext.kind === 'function') {
      const { block } = componentContext;
      if (!block) {
        return undefined;
      }

      const targetStatement = this.findContainingStatement(block, arrow);
      const insertOffset = targetStatement ? targetStatement.getStart(sourceFile) : block.getEnd() - 1;
      const insertPosition = document.positionAt(insertOffset);
      const indent = this.indentationService.getLineIndent(document, insertPosition.line);
      const indentUnit = this.indentationService.resolveIndentUnit(editorOptions);
      const insertText = this.buildConstHandlerText(indent, indentUnit, handlerName, paramsWrapped, body);
      const handlerDefinitionOffset = insertOffset + indent.length + 'const '.length;

      return { insertPosition, insertText, handlerDefinitionOffset };
    }

    const insertOffset = componentContext.containingMember.getStart(sourceFile);
    const insertPosition = document.positionAt(insertOffset);
    const indent = this.indentationService.getLineIndent(document, insertPosition.line);
    const indentUnit = this.indentationService.resolveIndentUnit(editorOptions);
    const insertText = this.buildMethodText(indent, indentUnit, handlerName, paramsWrapped, body);
    const handlerDefinitionOffset = insertOffset + indent.length;

    return { insertPosition, insertText, handlerDefinitionOffset };
  }

  private buildConstHandlerText(
    indent: string,
    indentUnit: string,
    handlerName: string,
    paramsWrapped: string,
    body: ArrowBodyBuildResult,
  ): string {
    if (body.kind === 'block') {
      const normalized = normalizeBlockBody(body.text, indent + indentUnit);
      const closingLine = `${indent}};`;
      const bodyContent = normalized ? `\n${normalized}\n` : '\n';
      return `${indent}const ${handlerName} = ${paramsWrapped} => {${bodyContent}${closingLine}\n\n`;
    }

    return `${indent}const ${handlerName} = ${paramsWrapped} => ${body.text};\n\n`;
  }

  private buildMethodText(
    indent: string,
    indentUnit: string,
    handlerName: string,
    paramsWrapped: string,
    body: ArrowBodyBuildResult,
  ): string {
    if (body.kind === 'block') {
      const normalized = normalizeBlockBody(body.text, indent + indentUnit);
      const bodyContent = normalized ? `\n${normalized}\n` : '\n';
      return `${indent}${handlerName}${paramsWrapped} {${bodyContent}${indent}}\n\n`;
    }

    const returnLine = `${indent + indentUnit}return ${body.text};`;
    return `${indent}${handlerName}${paramsWrapped} {\n${returnLine}\n${indent}}\n\n`;
  }

  private findContainingStatement(block: ts.Block, arrow: ts.ArrowFunction): ts.Statement | undefined {
    return block.statements.find((statement) => arrow.pos >= statement.pos && arrow.end <= statement.end);
  }
}
