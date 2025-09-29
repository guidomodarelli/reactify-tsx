import * as vscode from 'vscode';
import { ScriptKindResolver } from '../utils/scriptKindResolver';
import { ArrowFunctionLocator } from '../services/arrowFunctionLocator';
import { ComponentContextResolver } from '../services/componentContextResolver';
import { HandlerNameFactory } from '../services/handlerNameFactory';
import { ReactEventTypeResolver } from '../services/reactEventTypeResolver';
import { ParameterTextBuilder } from '../services/parameterTextBuilder';
import { ArrowBodyBuilder } from '../services/arrowBodyBuilder';
import { IndentationService } from '../utils/indentationService';
import { InsertionPlanner } from '../services/insertionPlanner';
import { ArrowFunctionExtractionService } from '../services/arrowFunctionExtractionService';
import { FunctionTransformationService } from '../services/functionTransformationService';
import { IfElseFlipService } from '../services/ifElseFlipService';
import { EnumToConstService } from '../services/enumToConstService';
import { JsxAttributeValueToggleService } from '../services/jsxAttributeValueToggleService';
import { BlockMovementService, MoveBlockDirection } from '../services/blockMovementService';
import { VariableKindConversionService } from '../services/variableKindConversionService';
import { VariableSplitService } from '../services/variableSplitService';
import { VariableMergeService } from '../services/variableMergeService';
import { ArrowParameterParensService } from '../services/arrowParameterParensService';
import { RedundantElseRemovalService } from '../services/redundantElseRemovalService';
import { UseCallbackWrapService } from '../services/useCallbackWrapService';
import { IfElseToConditionalService } from '../services/ifElseToConditionalService';
import { IfElseSimplifyService } from '../services/ifElseSimplifyService';
import { ConditionalSimplifyService } from '../services/conditionalSimplifyService';
import { NestedIfMergeService } from '../services/nestedIfMergeService';

interface RefactorFeatureDefinition {
  readonly commandId: string;
  readonly title: string;
  readonly kind: vscode.CodeActionKind;
  readonly evaluate: (document: vscode.TextDocument, selection: vscode.Selection) => boolean | Promise<boolean>;
}

const scriptKindResolver = new ScriptKindResolver();
const arrowFunctionLocator = new ArrowFunctionLocator();
const componentContextResolver = new ComponentContextResolver();
const handlerNameFactory = new HandlerNameFactory();
const reactEventTypeResolver = new ReactEventTypeResolver();
const parameterTextBuilder = new ParameterTextBuilder(reactEventTypeResolver);
const arrowBodyBuilder = new ArrowBodyBuilder();
const indentationService = new IndentationService();
const insertionPlanner = new InsertionPlanner(indentationService);
const extractionService = new ArrowFunctionExtractionService(
  scriptKindResolver,
  arrowFunctionLocator,
  componentContextResolver,
  handlerNameFactory,
  parameterTextBuilder,
  arrowBodyBuilder,
  insertionPlanner,
);

const transformationService = new FunctionTransformationService();
const flipService = new IfElseFlipService();
const enumConversionService = new EnumToConstService();
const toggleService = new JsxAttributeValueToggleService();
const blockMovementService = new BlockMovementService();
const variableKindService = new VariableKindConversionService();
const variableSplitService = new VariableSplitService();
const variableMergeService = new VariableMergeService();
const arrowParamParensService = new ArrowParameterParensService();
const redundantElseService = new RedundantElseRemovalService();
const useCallbackWrapService = new UseCallbackWrapService();
const ifElseToConditionalService = new IfElseToConditionalService();
const ifElseSimplifyService = new IfElseSimplifyService();
const conditionalSimplifyService = new ConditionalSimplifyService();
const nestedIfMergeService = new NestedIfMergeService();

export const ALL_REFACTOR_FEATURES: readonly RefactorFeatureDefinition[] = [
  {
    commandId: 'reactify-tsx.mergeNestedIf',
    title: 'Reactify TSX: Merge Nested If Statements',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = nestedIfMergeService.createMergePlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.extractArrowFunction',
    title: 'Reactify TSX: Extract Arrow Function to Handler',
    kind: vscode.CodeActionKind.RefactorExtract,
    evaluate: (document, selection) => {
      const result = extractionService.createExtractionPlan(document, selection, resolveEditorOptions(document));
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.addParensToSingleArrowParam',
    title: 'Reactify TSX: Add Parens to Single Arrow Parameter',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = arrowParamParensService.createAddParensPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.wrapWithUseCallback',
    title: 'Reactify TSX: Wrap Function with useCallback',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const plan = useCallbackWrapService.createPlan(document, selection);
      if (!plan.success) {
        console.log('wrapWithUseCallback unavailable', plan.reason);
      }
      return plan.success;
    },
  },
  {
    commandId: 'reactify-tsx.transformFunction',
    title: 'Reactify TSX: Transform Function',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const analysis = transformationService.analyze(document, selection);
      if (!analysis.success) {
        return false;
      }

      const choices = transformationService.listAvailableTransformations(analysis.context);
      return choices.length > 0;
    },
  },
  {
    commandId: 'reactify-tsx.simplifyIfElse',
    title: 'Reactify TSX: Simplify If/Else',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = ifElseSimplifyService.createSimplifyPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.replaceIfElseWithTernary',
    title: 'Reactify TSX: Replace If/Else with Ternary',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = ifElseToConditionalService.createReplacePlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.simplifyTernary',
    title: 'Reactify TSX: Simplify Ternary Expression',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = conditionalSimplifyService.createSimplifyPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.flipIfElse',
    title: 'Reactify TSX: Flip If/Else Branches',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = flipService.createFlipPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.removeRedundantElse',
    title: 'Reactify TSX: Remove Redundant Else',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = redundantElseService.createRemovalPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.enumToConst',
    title: 'Reactify TSX: Convert Enum to Const',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = enumConversionService.createConversionPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.toggleJsxAttributeValue',
    title: 'Reactify TSX: Toggle JSX Attribute Braces',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = toggleService.createTogglePlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.convertToLet',
    title: 'Reactify TSX: Convert Declaration to let',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = variableKindService.createConversionPlan(document, selection, 'let');
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.convertToConst',
    title: 'Reactify TSX: Convert Declaration to const',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = variableKindService.createConversionPlan(document, selection, 'const');
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.moveBlockUp',
    title: 'Reactify TSX: Move Block Up',
    kind: vscode.CodeActionKind.RefactorMove,
    evaluate: (document, selection) => {
      return canMoveBlock(document, selection, 'up');
    },
  },
  {
    commandId: 'reactify-tsx.moveBlockDown',
    title: 'Reactify TSX: Move Block Down',
    kind: vscode.CodeActionKind.RefactorMove,
    evaluate: (document, selection) => {
      return canMoveBlock(document, selection, 'down');
    },
  },
  {
    commandId: 'reactify-tsx.splitIntoMultipleDeclarations',
    title: 'Reactify TSX: Split Into Multiple Declarations',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = variableSplitService.createSplitMultiplePlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.splitDeclarationAndInitialization',
    title: 'Reactify TSX: Split Declaration and Initialization',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = variableSplitService.createSplitDeclarationAndInitializationPlan(document, selection);
      return result.success;
    },
  },
  {
    commandId: 'reactify-tsx.mergeDeclarationAndInitialization',
    title: 'Reactify TSX: Merge Declaration and Initialization',
    kind: vscode.CodeActionKind.RefactorRewrite,
    evaluate: (document, selection) => {
      const result = variableMergeService.createMergeDeclarationAndInitializationPlan(document, selection);
      return result.success;
    },
  },
];

const providedCodeActionKinds: readonly vscode.CodeActionKind[] = [
  vscode.CodeActionKind.Refactor,
  ...Array.from(
    new Map(
      ALL_REFACTOR_FEATURES.map((feature) => [feature.kind.value, feature.kind] as const),
    ).values(),
  ),
];

export class RefactorCodeActionProvider implements vscode.CodeActionProvider {
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): Promise<(vscode.Command | vscode.CodeAction)[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const onlyFilter = context.only;
    if (onlyFilter && !vscode.CodeActionKind.Refactor.contains(onlyFilter)) {
      return [];
    }

    const selection = new vscode.Selection(range.start, range.end);
    const actions: vscode.CodeAction[] = [];

    for (const feature of ALL_REFACTOR_FEATURES) {
      if (token.isCancellationRequested) {
        break;
      }

      if (onlyFilter && !onlyFilter.contains(feature.kind)) {
        continue;
      }

      const available = await feature.evaluate(document, selection);
      if (!available) {
        continue;
      }

      actions.push(createCodeAction(feature));
    }

    return actions;
  }
}

function createCodeAction(feature: RefactorFeatureDefinition): vscode.CodeAction {
  const action = new vscode.CodeAction(feature.title, feature.kind);
  action.command = {
    command: feature.commandId,
    title: feature.title,
  } satisfies vscode.Command;
  return action;
}

function canMoveBlock(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  direction: MoveBlockDirection,
): boolean {
  const result = blockMovementService.createMovePlan(document, selection, direction);
  return result.success;
}

function resolveEditorOptions(document: vscode.TextDocument): vscode.TextEditorOptions | undefined {
  const activeEditor = vscode.window.visibleTextEditors.find((editor) => editor.document === document);
  return activeEditor?.options;
}

export function createRefactorCodeActionsRegistration(): vscode.Disposable {
  const selector: vscode.DocumentSelector = [
    { language: 'typescriptreact' },
    { language: 'typescript' },
    { language: 'javascriptreact' },
    { language: 'javascript' },
  ];

  const provider = new RefactorCodeActionProvider();
  return vscode.languages.registerCodeActionsProvider(selector, provider, {
    providedCodeActionKinds,
  });
}
