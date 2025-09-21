import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { getRangeFromNode } from '../utils/typeScriptRangeUtils';
import type {
  EnumConversionPlanResult,
  EnumConversionPlanSuccess,
  EnumConversionFailureReason,
} from '../models/enumConversion';

interface EnumMemberDescriptor {
  readonly name: ts.PropertyName;
  readonly initializer: ts.Expression;
  readonly numericValue?: number;
}

export class EnumToConstService {
  private readonly scriptKindResolver = new ScriptKindResolver();
  private readonly printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  public createConversionPlan(document: vscode.TextDocument, selection: vscode.Selection): EnumConversionPlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(document.fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);

    const enumDeclaration = this.locateEnumDeclaration(sourceFile, selectionStart, selectionEnd);
    if (!enumDeclaration) {
      return this.failure('not-found');
    }

    if (
      this.hasModifier(enumDeclaration, ts.SyntaxKind.DeclareKeyword) ||
      this.hasModifier(enumDeclaration, ts.SyntaxKind.ConstKeyword)
    ) {
      return this.failure('unsupported');
    }

    const enumName = enumDeclaration.name?.text;
    if (!enumName) {
      return this.failure('unsupported');
    }

    const members = this.evaluateMembers(enumDeclaration);
    if (!members) {
      return this.failure('unsupported');
    }

    const hasExport = this.hasModifier(enumDeclaration, ts.SyntaxKind.ExportKeyword);
    const hasDefaultExport = this.hasModifier(enumDeclaration, ts.SyntaxKind.DefaultKeyword);

    const statements = this.buildReplacementStatements(sourceFile, enumName, members, hasExport, hasDefaultExport);
    let combined = statements.join('\n\n');
    while (combined.endsWith('\n\n')) {
      combined = combined.slice(0, -1);
    }
    if (!combined.endsWith('\n')) {
      combined += '\n';
    }
    const newText = combined;
    const range = getRangeFromNode(document, sourceFile, enumDeclaration);

    return {
      success: true,
      plan: {
        range,
        newText,
      },
    } satisfies EnumConversionPlanSuccess;
  }

  private buildReplacementStatements(
    sourceFile: ts.SourceFile,
    enumName: string,
    members: readonly EnumMemberDescriptor[],
    hasExport: boolean,
    hasDefaultExport: boolean,
  ): readonly string[] {
    const propertyAssignments = members.map((member) =>
      ts.factory.createPropertyAssignment(member.name, member.initializer),
    );

    const objectLiteral = ts.factory.createObjectLiteralExpression(propertyAssignments, true);
    const constAssertion = ts.factory.createAsExpression(
      objectLiteral,
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('const'), undefined),
    );

    const variableDeclaration = ts.factory.createVariableDeclaration(enumName, undefined, undefined, constAssertion);
    const declarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);

    const variableModifiers = hasExport && !hasDefaultExport
      ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : undefined;
    const constStatement = ts.factory.createVariableStatement(variableModifiers, declarationList);

    const typeQuery = ts.factory.createTypeQueryNode(ts.factory.createIdentifier(enumName));
    const keyOfType = ts.factory.createTypeOperatorNode(
      ts.SyntaxKind.KeyOfKeyword,
      ts.factory.createTypeQueryNode(ts.factory.createIdentifier(enumName)),
    );
    const indexedAccess = ts.factory.createIndexedAccessTypeNode(typeQuery, keyOfType);

    const typeModifiers = hasExport
      ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : undefined;
    const typeAlias = ts.factory.createTypeAliasDeclaration(typeModifiers, enumName, undefined, indexedAccess);

    const statements: ts.Statement[] = [constStatement, typeAlias];

    if (hasDefaultExport) {
      statements.push(ts.factory.createExportAssignment(undefined, false, ts.factory.createIdentifier(enumName)));
    }

    return statements.map((statement) => this.printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile));
  }

  private evaluateMembers(enumDeclaration: ts.EnumDeclaration): EnumMemberDescriptor[] | undefined {
    const descriptors: EnumMemberDescriptor[] = [];
    let previousNumeric: number | undefined;

    for (const member of enumDeclaration.members) {
      const descriptor = this.evaluateMember(member, previousNumeric);
      if (!descriptor) {
        return undefined;
      }

      descriptors.push(descriptor);
      previousNumeric = descriptor.numericValue;
    }

    return descriptors;
  }

  private evaluateMember(
    member: ts.EnumMember,
    previousNumeric: number | undefined,
  ): EnumMemberDescriptor | undefined {
    const name = this.resolveMemberName(member);
    if (!name) {
      return undefined;
    }

    const initializer = member.initializer;
    if (!initializer) {
      if (previousNumeric === undefined) {
        return {
          name,
          initializer: ts.factory.createNumericLiteral(0),
          numericValue: 0,
        };
      }

      const nextValue = previousNumeric + 1;
      return {
        name,
        initializer: ts.factory.createNumericLiteral(nextValue),
        numericValue: nextValue,
      };
    }

    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
      return {
        name,
        initializer: ts.factory.createStringLiteral(initializer.text, true),
      };
    }

    if (ts.isNumericLiteral(initializer)) {
      const numericValue = Number(initializer.text);
      return {
        name,
        initializer: ts.factory.createNumericLiteral(initializer.text),
        numericValue,
      };
    }

    if (ts.isPrefixUnaryExpression(initializer) && ts.isNumericLiteral(initializer.operand)) {
      const operand = Number(initializer.operand.text);
      switch (initializer.operator) {
        case ts.SyntaxKind.MinusToken: {
          const numericValue = -operand;
          return {
            name,
            initializer: ts.factory.createPrefixUnaryExpression(
              ts.SyntaxKind.MinusToken,
              ts.factory.createNumericLiteral(initializer.operand.text),
            ),
            numericValue,
          };
        }
        case ts.SyntaxKind.PlusToken: {
          const numericValue = operand;
          return {
            name,
            initializer: ts.factory.createNumericLiteral(initializer.operand.text),
            numericValue,
          };
        }
        default:
          return undefined;
      }
    }

    return undefined;
  }

  private resolveMemberName(member: ts.EnumMember): ts.PropertyName | undefined {
    const propertyName = member.name;
    if (ts.isIdentifier(propertyName)) {
      return ts.factory.createIdentifier(propertyName.text);
    }

    if (ts.isStringLiteral(propertyName) || ts.isNoSubstitutionTemplateLiteral(propertyName)) {
      return ts.factory.createStringLiteral(propertyName.text, true);
    }

    return undefined;
  }

  private locateEnumDeclaration(
    sourceFile: ts.SourceFile,
    selectionStart: number,
    selectionEnd: number,
  ): ts.EnumDeclaration | undefined {
    let bestMatch: ts.EnumDeclaration | undefined;

    const visit = (node: ts.Node) => {
      const nodeStart = node.getStart(sourceFile);
      const nodeEnd = node.getEnd();
      if (selectionStart < nodeStart || selectionEnd > nodeEnd) {
        return;
      }

      if (ts.isEnumDeclaration(node)) {
        bestMatch = node;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return bestMatch;
  }

  private hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const modifiers = (node as ts.HasModifiers).modifiers;
    return Boolean(modifiers?.some((modifier) => modifier.kind === kind));
  }

  private failure(reason: EnumConversionFailureReason): EnumConversionPlanResult {
    return {
      success: false,
      reason,
    };
  }
}
