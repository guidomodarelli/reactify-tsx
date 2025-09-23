import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import type { VariableSplitPlanResult, VariableSplitPlanSuccess } from '../models/variableSplit';

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

export class VariableMergeService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createMergeDeclarationAndInitializationPlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
  ): VariableSplitPlanResult {
    const context = this.parse(document);
    const match = this.locateDeclarationThenAssignment(
      context.sourceFile,
      document.offsetAt(selection.start),
      document.offsetAt(selection.end),
    );

    if (!match) {
      return { success: false, reason: 'not-found' };
    }

    const { declStatement, assignmentStatement, identifier, kindFlags } = match;

    // Build merged declaration with initializer from assignment
    const mergedDecl = ts.factory.createVariableDeclaration(
      identifier,
      /*exclamationToken*/ undefined,
      /*type*/ match.declaration.type ?? undefined,
      match.assignment.right,
    );
    const mergedList = ts.factory.createVariableDeclarationList([mergedDecl], kindFlags);
    const mergedStatement = ts.factory.createVariableStatement(declStatement.modifiers, mergedList);
    const newText = printer.printNode(ts.EmitHint.Unspecified, mergedStatement, context.sourceFile);

    // Replace both statements with the merged one
    const fullRange = new vscode.Range(
      getRangeFromNode(document, context.sourceFile, declStatement).start,
      getRangeFromNode(document, context.sourceFile, assignmentStatement).end,
    );

    return { success: true, plan: { range: fullRange, newText } } satisfies VariableSplitPlanSuccess;
  }

  private parse(document: vscode.TextDocument): { sourceFile: ts.SourceFile } {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const content = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, content, ts.ScriptTarget.Latest, true, scriptKind);
    return { sourceFile };
  }

  private locateDeclarationThenAssignment(
    root: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ):
    | {
        readonly declStatement: ts.VariableStatement;
        readonly assignmentStatement: ts.ExpressionStatement;
        readonly declaration: ts.VariableDeclaration;
        readonly assignment: ts.BinaryExpression;
        readonly identifier: ts.Identifier;
        readonly kindFlags: ts.NodeFlags;
      }
    | undefined {
    let found:
      | {
          readonly declStatement: ts.VariableStatement;
          readonly assignmentStatement: ts.ExpressionStatement;
          readonly declaration: ts.VariableDeclaration;
          readonly assignment: ts.BinaryExpression;
          readonly identifier: ts.Identifier;
          readonly kindFlags: ts.NodeFlags;
        }
      | undefined;

    const visit = (node: ts.Node) => {
      if (found) return;
      if (ts.isSourceFile(node) || ts.isBlock(node)) {
        const statements = node.statements;
        for (let i = 0; i < statements.length - 1; i++) {
          const a = statements[i];
          const b = statements[i + 1];

          if (!ts.isVariableStatement(a) || !ts.isExpressionStatement(b)) continue;

          // Check selection is inside either statement range
          const startA = a.getStart(root, false);
          const endB = b.getEnd();
          const selectionInside = selectionStart >= startA && selectionEnd <= endB;
          if (!selectionInside) continue;

          const list = a.declarationList;
          const declarations = list.declarations;
          if (declarations.length !== 1) continue;
          const declaration = declarations[0];
          if (!ts.isIdentifier(declaration.name)) continue;
          if (declaration.initializer) continue; // must be declaration without initializer

          const expr = b.expression;
          if (!ts.isBinaryExpression(expr)) continue;
          if (expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
          if (!ts.isIdentifier(expr.left)) continue;

          // names must match and not be const
          const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
          if (isConst) continue;
          if (expr.left.text !== declaration.name.text) continue;

          found = {
            declStatement: a,
            assignmentStatement: b,
            declaration,
            assignment: expr,
            identifier: declaration.name,
            kindFlags: list.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let),
          };
          break;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
  }
}

