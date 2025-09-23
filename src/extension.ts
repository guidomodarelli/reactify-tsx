import * as vscode from 'vscode';
import { extractArrowFunctionCommand } from './commands/extractArrowFunctionCommand';
import { transformFunctionCommand } from './commands/transformFunctionCommand';
import { flipIfElseCommand } from './commands/flipIfElseCommand';
import { enumToConstCommand } from './commands/enumToConstCommand';
import { convertToLetCommand } from './commands/convertToLetCommand';
import { convertToConstCommand } from './commands/convertToConstCommand';
import { moveBlockDownCommand, moveBlockUpCommand } from './commands/moveBlockCommand';
import { toggleJsxAttributeValueCommand } from './commands/toggleJsxAttributeValueCommand';
import { toggleStringTemplateCommand } from './commands/toggleStringTemplateCommand';
import { splitIntoMultipleDeclarationsCommand } from './commands/splitIntoMultipleDeclarationsCommand';
import { splitDeclarationAndInitializationCommand } from './commands/splitDeclarationAndInitializationCommand';
import { createRefactorCodeActionsRegistration } from './code-actions';
import { splitOrMergeStringCommand } from './commands/splitOrMergeStringCommand';
import { mergeDeclarationAndInitializationCommand } from './commands/mergeDeclarationAndInitializationCommand';

const commandRegistrations: vscode.Disposable[] = [];
let commandsInitialized = false;

export function activate(context: vscode.ExtensionContext): void {
  if (!commandsInitialized) {
    commandsInitialized = true;

    const definitions: Array<[string, () => void | Promise<void>]> = [
      ['reactify-tsx.extractArrowFunction', () => extractArrowFunctionCommand()],
      ['reactify-tsx.transformFunction', () => transformFunctionCommand()],
      ['reactify-tsx.flipIfElse', () => flipIfElseCommand()],
      ['reactify-tsx.enumToConst', () => enumToConstCommand()],
      ['reactify-tsx.convertToLet', () => convertToLetCommand()],
      ['reactify-tsx.convertToConst', () => convertToConstCommand()],
      ['reactify-tsx.moveBlockUp', () => moveBlockUpCommand()],
      ['reactify-tsx.moveBlockDown', () => moveBlockDownCommand()],
      ['reactify-tsx.toggleJsxAttributeValue', () => toggleJsxAttributeValueCommand()],
      ['reactify-tsx.toggleStringTemplate', () => toggleStringTemplateCommand()],
      ['reactify-tsx.splitIntoMultipleDeclarations', () => splitIntoMultipleDeclarationsCommand()],
      ['reactify-tsx.splitDeclarationAndInitialization', () => splitDeclarationAndInitializationCommand()],
      ['reactify-tsx.mergeDeclarationAndInitialization', () => mergeDeclarationAndInitializationCommand()],
      ['reactify-tsx.splitOrMergeString', () => splitOrMergeStringCommand()],
    ];

    for (const [commandId, handler] of definitions) {
      try {
        const registration = vscode.commands.registerCommand(commandId, handler);
        commandRegistrations.push(registration);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    commandRegistrations.push(createRefactorCodeActionsRegistration());
  }

  for (const disposable of commandRegistrations) {
    context.subscriptions.push(disposable);
  }
}

export function deactivate(): void {}
