// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extractArrowFunctionCommand } from './commands/extractArrowFunctionCommand';
import { transformFunctionCommand } from './commands/transformFunctionCommand';
import { flipIfElseCommand } from './commands/flipIfElseCommand';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('reactify-tsx.extractArrowFunction', () => extractArrowFunctionCommand()),
		vscode.commands.registerCommand('reactify-tsx.transformFunction', () => transformFunctionCommand()),
		vscode.commands.registerCommand('reactify-tsx.flipIfElse', () => flipIfElseCommand())
	);
}

export function deactivate() {}
