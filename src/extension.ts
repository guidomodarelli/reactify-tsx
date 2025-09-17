// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extractArrowFunctionCommand } from './refactor/extractArrowFunction';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('reactify-tsx.extractArrowFunction', () => extractArrowFunctionCommand())
	);
}

export function deactivate() {}
