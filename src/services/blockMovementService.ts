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
type ClassContainer = ts.ClassDeclaration | ts.ClassExpression;
type TypeElementContainer = ts.InterfaceDeclaration | ts.TypeLiteralNode;
type MovableNode = ts.Statement | ts.ClassElement | ts.TypeElement | ts.EnumMember;

type MovableContainer =
  | { readonly kind: 'statement'; readonly node: StatementContainer }
  | { readonly kind: 'class'; readonly node: ClassContainer }
  | { readonly kind: 'type-element'; readonly node: TypeElementContainer }
  | { readonly kind: 'enum'; readonly node: ts.EnumDeclaration };

interface MovableContext {
  readonly node: MovableNode;
  readonly container: MovableContainer;
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

    const context = this.locateMovableNode(
      sourceFile,
      selectionOffsets.start,
      selectionOffsets.end,
    );

    if (!context) {
      return { success: false, reason: 'not-found' } satisfies MovePlanFailure;
    }

    const candidates = Array.from(this.getContainerMembers(context.container));
    const currentIndex = candidates.indexOf(context.node);
    if (currentIndex === -1) {
      return { success: false, reason: 'not-found' } satisfies MovePlanFailure;
    }

    const neighborIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (neighborIndex < 0 || neighborIndex >= candidates.length) {
      return { success: false, reason: 'at-boundary' } satisfies MovePlanFailure;
    }

    const neighborNode = candidates[neighborIndex]!;

    const movement = this.buildMovementPlan(
      document,
      sourceFile,
      sourceText,
      context.node,
      neighborNode,
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
    target: MovableNode,
    neighbor: MovableNode,
    direction: MoveBlockDirection,
  ): MovePlan {
    const firstNode = direction === 'up' ? neighbor : target;
    const secondNode = direction === 'up' ? target : neighbor;

    const firstStart = this.getMovementBlockStart(firstNode, sourceFile, sourceText);
    const firstEnd = firstNode.getEnd();
    const secondStart = this.getMovementBlockStart(secondNode, sourceFile, sourceText);
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

  private locateMovableNode(
    sourceFile: ts.SourceFile,
    start: number,
    end: number,
  ): MovableContext | undefined {
    const innermostNode = this.findInnermostNodeContainingRange(sourceFile, sourceFile, start, end);
    if (!innermostNode) {
      return undefined;
    }

    let current: ts.Node | undefined = innermostNode;
    while (current) {
      const parent: ts.Node | undefined = current.parent;
      if (!parent) {
        current = parent;
        continue;
      }

      const container = this.resolveMovableContainer(parent);
      if (
        container &&
        this.isMovableWithinContainer(current, container) &&
        this.enclosesRange(current, sourceFile, start, end)
      ) {
        return { node: current as MovableNode, container };
      }

      current = parent;
    }

    return undefined;
  }

  private resolveMovableContainer(node: ts.Node): MovableContainer | undefined {
    if (this.isStatementContainer(node)) {
      return { kind: 'statement', node };
    }

    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      return { kind: 'class', node };
    }

    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      return { kind: 'type-element', node };
    }

    if (ts.isEnumDeclaration(node)) {
      return { kind: 'enum', node };
    }

    return undefined;
  }

  private getContainerMembers(container: MovableContainer): readonly MovableNode[] {
    switch (container.kind) {
      case 'statement':
        return container.node.statements as readonly MovableNode[];
      case 'class':
        return container.node.members as readonly MovableNode[];
      case 'type-element':
        return container.node.members as readonly MovableNode[];
      case 'enum':
        return container.node.members as readonly MovableNode[];
      default:
        return [] as readonly MovableNode[];
    }
  }

  private isMovableWithinContainer(node: ts.Node, container: MovableContainer): node is MovableNode {
    switch (container.kind) {
      case 'statement':
        return this.isMovableStatement(node);
      case 'class':
        return this.isMovableClassElement(node);
      case 'type-element':
        return this.isMovableTypeElement(node);
      case 'enum':
        return ts.isEnumMember(node);
      default:
        return false;
    }
  }

  private isMovableClassElement(node: ts.Node): node is ts.ClassElement {
    return ts.isClassElement(node) && !ts.isSemicolonClassElement(node);
  }

  private isMovableTypeElement(node: ts.Node): node is ts.TypeElement {
    return ts.isTypeElement(node);
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

  private getMovementBlockStart(
    node: MovableNode,
    sourceFile: ts.SourceFile,
    sourceText: string,
  ): number {
    let blockStart = node.getStart(sourceFile);
    const commentRanges = ts.getLeadingCommentRanges(sourceText, node.pos) ?? [];

    for (let index = commentRanges.length - 1; index >= 0; index -= 1) {
      const range = commentRanges[index]!;
      const lineStart = this.findLineStart(sourceText, range.pos);
      const linePrefix = sourceText.slice(lineStart, range.pos);
      if (linePrefix.trim().length > 0) {
        continue;
      }

      const gap = sourceText.slice(range.end, blockStart);
      if (!this.isWhitespaceOnly(gap) || this.containsBlankLine(gap)) {
        continue;
      }

      blockStart = lineStart;
    }

    return blockStart;
  }

  private findLineStart(sourceText: string, position: number): number {
    const lastLineBreak = sourceText.lastIndexOf('\n', position - 1);
    if (lastLineBreak === -1) {
      return 0;
    }
    return lastLineBreak + 1;
  }

  private isWhitespaceOnly(value: string): boolean {
    return value.trim().length === 0;
  }

  private containsBlankLine(value: string): boolean {
    const normalized = value.replace(/\r\n/g, '\n');
    return normalized.includes('\n\n');
  }
}




