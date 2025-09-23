import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';

export type StringTemplateTogglePlanFailureReason = 'not-found' | 'unsupported';

export interface StringTemplateTogglePlan {
  readonly range: vscode.Range;
  readonly newText: string;
  readonly mode: 'to-template' | 'to-string';
}

export interface StringTemplateTogglePlanSuccess {
  readonly success: true;
  readonly plan: StringTemplateTogglePlan;
}

export interface StringTemplateTogglePlanFailure {
  readonly success: false;
  readonly reason: StringTemplateTogglePlanFailureReason;
}

export type StringTemplateTogglePlanResult = StringTemplateTogglePlanSuccess | StringTemplateTogglePlanFailure;

export class StringTemplateToggleService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createTogglePlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): StringTemplateTogglePlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const selectionStart = Math.min(document.offsetAt(selection.start), document.offsetAt(selection.end));
    const selectionEnd = Math.max(document.offsetAt(selection.start), document.offsetAt(selection.end));

    const literal = this.locateLiteral(sourceFile, selectionStart, selectionEnd);
    if (!literal) {
      return { success: false, reason: 'not-found' } satisfies StringTemplateTogglePlanFailure;
    }

    if (ts.isStringLiteral(literal)) {
      return this.buildToTemplatePlan(document, sourceFile, literal);
    }

    if (ts.isNoSubstitutionTemplateLiteral(literal)) {
      return this.buildToStringPlan(document, sourceFile, literal);
    }

    // Template expressions with placeholders are not supported for conversion.
    return { success: false, reason: 'unsupported' } satisfies StringTemplateTogglePlanFailure;
  }

  private buildToTemplatePlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    literal: ts.StringLiteral,
  ): StringTemplateTogglePlanResult {
    const range = getRangeFromNode(document, sourceFile, literal);
    const content = literal.text;
    const escaped = content.replace(/`/g, '\\`').replace(/\$\{/g, '\\\${');
    const newText = `\`${escaped}\``;
    return { success: true, plan: { range, newText, mode: 'to-template' } } satisfies StringTemplateTogglePlanSuccess;
  }

  private buildToStringPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    literal: ts.NoSubstitutionTemplateLiteral,
  ): StringTemplateTogglePlanResult {
    // Convert only no-substitution templates (handled by type), preserving content with escapes.
    const range = getRangeFromNode(document, sourceFile, literal);
    const content = literal.text;
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    const newText = `'${escaped}'`;
    return { success: true, plan: { range, newText, mode: 'to-string' } } satisfies StringTemplateTogglePlanSuccess;
  }

  private locateLiteral(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression | undefined {
    let match: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression | undefined;

    const visit = (node: ts.Node) => {
      if (match) {
        return;
      }

      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }

      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        match = node;
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return match;
  }
}

