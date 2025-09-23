import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import type {
  VariableKindConversionPlanResult,
  VariableKindTarget,
  VariableKindConversionPlanSuccess,
} from '../models/variableKindConversion';

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class VariableKindConversionService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createConversionPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    target: VariableKindTarget,
  ): VariableKindConversionPlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);

    const variableStatement = this.locateVariableStatement(sourceFile, selectionStart, selectionEnd);
    if (!variableStatement) {
      return { success: false, reason: 'not-found' };
    }

    const list = variableStatement.declarationList;

    const currentKind = this.getDeclarationKind(list);
    if (target === 'let') {
      if (currentKind === 'let') {
        // No-op; treat as unsupported to avoid meaningless edit.
        return { success: false, reason: 'unsupported' };
      }
      const updated = this.reprintWithKind(sourceFile, variableStatement, ts.NodeFlags.Let);
      const range = getRangeFromNode(document, sourceFile, variableStatement);
      return { success: true, plan: { range, newText: updated } } satisfies VariableKindConversionPlanSuccess;
    }

    // target === 'const'
    if (currentKind === 'const') {
      return { success: false, reason: 'unsupported' };
    }

    if (!this.isConstConvertible(sourceFile, variableStatement)) {
      return { success: false, reason: 'unsupported' };
    }

    const updated = this.reprintWithKind(sourceFile, variableStatement, ts.NodeFlags.Const);
    const range = getRangeFromNode(document, sourceFile, variableStatement);
    return { success: true, plan: { range, newText: updated } } satisfies VariableKindConversionPlanSuccess;
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

  private getDeclarationKind(list: ts.VariableDeclarationList): 'var' | 'let' | 'const' {
    if ((list.flags & ts.NodeFlags.Const) !== 0) return 'const';
    if ((list.flags & ts.NodeFlags.Let) !== 0) return 'let';
    return 'var';
  }

  private reprintWithKind(
    sourceFile: ts.SourceFile,
    statement: ts.VariableStatement,
    newKind: ts.NodeFlags,
  ): string {
    const declarationList = ts.factory.createVariableDeclarationList([...statement.declarationList.declarations], newKind);
    const updated = ts.factory.createVariableStatement(statement.modifiers, declarationList);
    return printer.printNode(ts.EmitHint.Unspecified, updated, sourceFile);
  }

  private isConstConvertible(sourceFile: ts.SourceFile, statement: ts.VariableStatement): boolean {
    const names: string[] = [];
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) {
        return false; // Keep v1 simple: only simple identifiers.
      }
      if (!decl.initializer) {
        return false; // const requires initializer
      }
      names.push(decl.name.text);
    }

    const declarationEnd = statement.getEnd();

    let safe = true;
    const assignmentOperators = new Set<ts.SyntaxKind>([
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.MinusEqualsToken,
      ts.SyntaxKind.AsteriskEqualsToken,
      ts.SyntaxKind.AsteriskAsteriskEqualsToken,
      ts.SyntaxKind.SlashEqualsToken,
      ts.SyntaxKind.PercentEqualsToken,
      ts.SyntaxKind.LessThanLessThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
      ts.SyntaxKind.AmpersandEqualsToken,
      ts.SyntaxKind.BarEqualsToken,
      ts.SyntaxKind.CaretEqualsToken,
    ]);

    const visit = (node: ts.Node) => {
      if (!safe) return;
      // Only consider writes after the declaration end to avoid flagging the initializer.
      if (node.getStart(sourceFile, false) <= declarationEnd) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isBinaryExpression(node) && assignmentOperators.has(node.operatorToken.kind)) {
        const left = node.left;
        if (ts.isIdentifier(left) && names.includes(left.text)) {
          safe = false;
          return;
        }
      }
      if (
        (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        const operand = (node as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression).operand;
        if (ts.isIdentifier(operand) && names.includes(operand.text)) {
          safe = false;
          return;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return safe;
  }
}

