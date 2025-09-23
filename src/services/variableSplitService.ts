import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import type { VariableSplitPlanResult, VariableSplitPlanSuccess } from '../models/variableSplit';

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class VariableSplitService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createSplitMultiplePlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): VariableSplitPlanResult {
    const context = this.parse(document);
    const variableStatement = this.locateVariableStatement(context.sourceFile, document.offsetAt(selection.start), document.offsetAt(selection.end));
    if (!variableStatement) {
      return { success: false, reason: 'not-found' };
    }

    const list = variableStatement.declarationList;
    const declarations = list.declarations;

    if (declarations.length <= 1) {
      return { success: false, reason: 'unsupported' };
    }

    if (!declarations.every((d) => ts.isIdentifier(d.name))) {
      return { success: false, reason: 'unsupported' };
    }

    const kindFlags = list.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let);
    const parts = declarations.map((decl) => {
      const singleList = ts.factory.createVariableDeclarationList([decl], kindFlags);
      const stmt = ts.factory.createVariableStatement(variableStatement.modifiers, singleList);
      return printer.printNode(ts.EmitHint.Unspecified, stmt, context.sourceFile);
    });

    const indent = this.computeIndent(document, context.sourceFile, variableStatement);
    const newText = this.joinWithIndent(parts, indent);
    const range = getRangeFromNode(document, context.sourceFile, variableStatement);
    return { success: true, plan: { range, newText } } satisfies VariableSplitPlanSuccess;
  }

  public createSplitDeclarationAndInitializationPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): VariableSplitPlanResult {
    const context = this.parse(document);
    const variableStatement = this.locateVariableStatement(context.sourceFile, document.offsetAt(selection.start), document.offsetAt(selection.end));
    if (!variableStatement) {
      return { success: false, reason: 'not-found' };
    }

    const list = variableStatement.declarationList;
    const declarations = list.declarations;
    if (declarations.length !== 1) {
      return { success: false, reason: 'unsupported' };
    }

    const decl = declarations[0];
    if (!ts.isIdentifier(decl.name) || !decl.initializer) {
      return { success: false, reason: 'unsupported' };
    }

    const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
    if (isConst) {
      return { success: false, reason: 'unsupported' };
    }

    // First statement: declaration without initializer (preserve var/let kind)
    const kindFlags = list.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let);
    const declWithoutInit = ts.factory.createVariableDeclaration(decl.name, decl.exclamationToken, decl.type, /*initializer*/ undefined);
    const listWithoutInit = ts.factory.createVariableDeclarationList([declWithoutInit], kindFlags);
    const firstStmt = ts.factory.createVariableStatement(variableStatement.modifiers, listWithoutInit);

    // Second statement: assignment `name = initializer;`
    const assignment = ts.factory.createBinaryExpression(
      ts.factory.createIdentifier(decl.name.text),
      ts.factory.createToken(ts.SyntaxKind.EqualsToken),
      decl.initializer,
    );
    const secondStmt = ts.factory.createExpressionStatement(assignment);

    const firstText = printer.printNode(ts.EmitHint.Unspecified, firstStmt, context.sourceFile);
    const secondText = printer.printNode(ts.EmitHint.Unspecified, secondStmt, context.sourceFile);

    const indent = this.computeIndent(document, context.sourceFile, variableStatement);
    const newText = this.joinWithIndent([firstText, secondText], indent);
    const range = getRangeFromNode(document, context.sourceFile, variableStatement);
    return { success: true, plan: { range, newText } } satisfies VariableSplitPlanSuccess;
  }

  private parse(document: vscode.TextDocument): { sourceFile: ts.SourceFile } {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const content = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, content, ts.ScriptTarget.Latest, true, scriptKind);
    return { sourceFile };
  }

  private locateVariableStatement(
    root: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.VariableStatement | undefined {
    let match: ts.VariableStatement | undefined;
    const visit = (node: ts.Node) => {
      if (match) return;
      if (ts.isVariableStatement(node)) {
        const start = node.getStart(root, false);
        const end = node.getEnd();
        const contains = selectionStart >= start && selectionEnd <= end;
        if (contains) {
          match = node;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return match;
  }

  private computeIndent(document: vscode.TextDocument, sourceFile: ts.SourceFile, node: ts.Node): string {
    const start = node.getStart(sourceFile);
    const startPos = document.positionAt(start);
    const line = document.lineAt(startPos.line);
    const prefix = line.text.slice(0, startPos.character);
    const indent = /^\s*/.exec(prefix)?.[0] ?? '';
    return indent;
  }

  private joinWithIndent(parts: readonly string[], indent: string): string {
    if (parts.length === 0) return '';
    return parts[0] + parts.slice(1).map((p) => `\n${indent}${p}`).join('');
  }
}

