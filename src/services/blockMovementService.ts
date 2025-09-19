import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ScriptKindResolver } from '../utils/scriptKindResolver';

export type MoveBlockDirection = 'up' | 'down';

export interface MovePlan {
  readonly range: vscode.Range;
  readonly newText: string;
  readonly anchorRelativeOffset: number;
}

export interface MovePlanSuccess {
  readonly success: true;
  readonly plan: MovePlan;
}

export type MovePlanFailureReason = 'not-found' | 'at-boundary';

export interface MovePlanFailure {
  readonly success: false;
  readonly reason: MovePlanFailureReason;
}

export type MovePlanResult = MovePlanSuccess | MovePlanFailure;

type StatementContainer = ts.SourceFile | ts.Block | ts.ModuleBlock;

interface MovableStatementContext {
  readonly statement: ts.Statement;
  readonly container: StatementContainer;
}

export class BlockMovementService {
  private readonly scriptKindResolver = new ScriptKindResolver();

  public createMovePlan(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    direction: MoveBlockDirection,
  ): MovePlanResult {
    const scriptKind = this.scriptKindResolver.resolve(document);
    const sourceText = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const selectionOffsets = this.normalizeSelectionOffsets(
      sourceText,
      document.offsetAt(selection.start),
      document.offsetAt(selection.end),
    );

    const context = this.locateMovableStatement(
      sourceFile,
      sourceText,
      selectionOffsets.start,
      selectionOffsets.end,
    );

    if (!context) {
      return { success: false, reason: 'not-found' } satisfies MovePlanFailure;
    }

    const statements = Array.from(context.container.statements);
    const currentIndex = statements.indexOf(context.statement);
    if (currentIndex === -1) {
      return { success: false, reason: 'not-found' } satisfies MovePlanFailure;
    }

    const neighborIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (neighborIndex < 0 || neighborIndex >= statements.length) {
      return { success: false, reason: 'at-boundary' } satisfies MovePlanFailure;
    }

    const neighborStatement = statements[neighborIndex]!;

    const movement = this.buildMovementPlan(
      document,
      sourceFile,
      sourceText,
      context.statement,
      neighborStatement,
      direction,
    );

    return {
      success: true,
      plan: movement,
    } satisfies MovePlanSuccess;
  }

  private buildMovementPlan(
    document: vscode.TextDocument,
    sourceFile: ts.SourceFile,
    sourceText: string,
    target: ts.Statement,
    neighbor: ts.Statement,
    direction: MoveBlockDirection,
  ): MovePlan {
    const firstNode = direction === 'up' ? neighbor : target;
    const secondNode = direction === 'up' ? target : neighbor;

    const firstStart = firstNode.getStart(sourceFile);
    const firstEnd = firstNode.getEnd();
    const secondStart = secondNode.getStart(sourceFile);
    const secondEnd = secondNode.getEnd();

    const middleText = sourceText.slice(firstEnd, secondStart);
    const firstText = sourceText.slice(firstStart, firstEnd);
    const secondText = sourceText.slice(secondStart, secondEnd);

    const newText = secondText + middleText + firstText;
    const rangeStart = firstStart;
    const rangeEnd = secondEnd;

    const anchorRelativeOffset = direction === 'up'
      ? 0
      : secondText.length + middleText.length;

    return {
      range: new vscode.Range(
        document.positionAt(rangeStart),
        document.positionAt(rangeEnd),
      ),
      newText,
      anchorRelativeOffset,
    } satisfies MovePlan;
  }

  private locateMovableStatement(
    sourceFile: ts.SourceFile,
    sourceText: string,
    start: number,
    end: number,
  ): MovableStatementContext | undefined {
    const innermostNode = this.findInnermostNodeContainingRange(sourceFile, sourceFile, start, end);
    if (!innermostNode) {
      return undefined;
    }

    let current: ts.Node | undefined = innermostNode;
    while (current) {
      if (this.isMovableStatement(current) && this.enclosesRange(current, sourceFile, start, end)) {
        const container = current.parent;
        if (container && this.isStatementContainer(container)) {
          return { statement: current, container } satisfies MovableStatementContext;
        }
      }
      current = current.parent;
    }

    return undefined;
  }

  private findInnermostNodeContainingRange(
    searchRoot: ts.Node,
    sourceFile: ts.SourceFile,
    start: number,
    end: number,
  ): ts.Node | undefined {
    if (!this.enclosesWithTrivia(searchRoot, sourceFile, start, end)) {
      return undefined;
    }

    let deepestMatch: ts.Node | undefined;
    searchRoot.forEachChild((child) => {
      if (deepestMatch) {
        return;
      }

      if (!this.enclosesWithTrivia(child, sourceFile, start, end)) {
        return;
      }

      const descendant = this.findInnermostNodeContainingRange(child, sourceFile, start, end);
      deepestMatch = descendant ?? child;
    });

    if (!deepestMatch) {
      return searchRoot;
    }

    return deepestMatch;
  }

  private enclosesWithTrivia(node: ts.Node, sourceFile: ts.SourceFile, start: number, end: number): boolean {
    const nodeFullStart = node.getFullStart();
    const nodeEnd = node.getEnd();
    const lowerBound = Math.min(nodeFullStart, node.getStart(sourceFile));
    return start >= lowerBound && end <= nodeEnd;
  }

  private enclosesRange(node: ts.Node, sourceFile: ts.SourceFile, start: number, end: number): boolean {
    const nodeLowerBound = Math.min(node.getFullStart(), node.getStart(sourceFile));
    return start >= nodeLowerBound && end <= node.getEnd();
  }

  private isMovableStatement(node: ts.Node): node is ts.Statement {
    if (!ts.isStatement(node)) {
      return false;
    }

    if (ts.isBlock(node)) {
      return false;
    }

    return (
      ts.isFunctionDeclaration(node) ||
      ts.isIfStatement(node) ||
      ts.isIterationStatement(node, false) ||
      ts.isSwitchStatement(node) ||
      ts.isTryStatement(node) ||
      ts.isVariableStatement(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    );
  }

  private isStatementContainer(node: ts.Node): node is StatementContainer {
    return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node);
  }

  private normalizeSelectionOffsets(sourceText: string, rawStart: number, rawEnd: number): {
    start: number;
    end: number;
  } {
    const normalizedStart = Math.min(rawStart, rawEnd);
    const normalizedEnd = Math.max(rawStart, rawEnd);

    if (normalizedStart !== normalizedEnd) {
      return { start: normalizedStart, end: normalizedEnd };
    }

    let adjustedStart = normalizedStart;
    while (adjustedStart > 0) {
      const candidate = sourceText.charAt(adjustedStart - 1);
      if (candidate === ' ' || candidate === '\t') {
        adjustedStart -= 1;
        continue;
      }

      if (candidate === '\r' || candidate === '\n') {
        break;
      }

      adjustedStart -= 1;
      break;
    }

    return {
      start: adjustedStart,
      end: normalizedEnd,
    };
  }
}




