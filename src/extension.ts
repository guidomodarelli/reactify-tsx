import * as vscode from 'vscode';
import { extractArrowFunctionCommand } from './commands/extractArrowFunctionCommand';
import { transformFunctionCommand } from './commands/transformFunctionCommand';
import { flipIfElseCommand } from './commands/flipIfElseCommand';

const commandRegistrations: vscode.Disposable[] = [];
let commandsInitialized = false;

export function activate(context: vscode.ExtensionContext): void {
  if (!commandsInitialized) {
    commandsInitialized = true;

    const definitions: Array<[string, () => void | Promise<void>]> = [
      ['reactify-tsx.extractArrowFunction', () => extractArrowFunctionCommand()],
      ['reactify-tsx.transformFunction', () => transformFunctionCommand()],
      ['reactify-tsx.flipIfElse', () => flipIfElseCommand()],
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
  }

  for (const disposable of commandRegistrations) {
    context.subscriptions.push(disposable);
  }
}

export function deactivate(): void {}
