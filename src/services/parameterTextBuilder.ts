import type * as vscode from 'vscode';
import * as ts from 'typescript';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import { ReactEventTypeResolver } from './reactEventTypeResolver';

/**
 * Reconstructs parameter text while enriching it with inferred typings when possible.
 */
export class ParameterTextBuilder {
  public constructor(private readonly eventTypeResolver: ReactEventTypeResolver) {}

  public buildParametersText(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    arrow: ts.ArrowFunction,
    attribute: ts.JsxAttribute,
  ): string {
    if (arrow.parameters.length === 0) {
      return '';
    }

    return arrow.parameters
      .map((parameter, index) =>
        this.buildParameterString(document, sourceFile, parameter, index, attribute, arrow),
      )
      .join(', ');
  }

  private buildParameterString(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    parameter: ts.ParameterDeclaration,
    index: number,
    attribute: ts.JsxAttribute,
    arrow: ts.ArrowFunction,
  ): string {
    const originalText = document.getText(getRangeFromNode(document, sourceFile, parameter));
    if (parameter.type) {
      return originalText;
    }

    if (!ts.isIdentifier(parameter.name)) {
      return `/* FIXME: add type manually */ ${originalText}`;
    }

    const inferredType = index === 0 ? this.eventTypeResolver.inferEventType(attribute, sourceFile) : undefined;
    const parameterName = parameter.name.getText(sourceFile);
    const optionalToken = parameter.questionToken ? '?' : '';
    const restToken = parameter.dotDotDotToken ? '...' : '';
    const initializer = parameter.initializer
      ? ` = ${document.getText(getRangeFromNode(document, sourceFile, parameter.initializer))}`
      : '';

    if (inferredType) {
      return `${restToken}${parameterName}${optionalToken}: ${inferredType}${initializer}`;
    }

    return `/* FIXME: add type manually */ ${originalText}`;
  }
}
