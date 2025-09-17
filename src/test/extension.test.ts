import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate } from '../extension';

suite('Command Registration', () => {
	suiteSetup(() => {
		const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
		activate(context);
	});
	test('registers extract and transform commands', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('reactify-tsx.extractArrowFunction'));
		assert.ok(commands.includes('reactify-tsx.transformFunction'));
	});
});
