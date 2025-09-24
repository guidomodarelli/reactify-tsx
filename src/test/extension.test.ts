import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate } from '../extension';

suite('Command Registration', () => {
  const contexts: vscode.ExtensionContext[] = [];

  teardown(() => {
    while (contexts.length > 0) {
      const context = contexts.pop()!;
      for (const disposable of context.subscriptions) {
        disposable.dispose();
      }
    }
  });

  test('registers extension commands', async () => {
    const context = createContext();
    contexts.push(context);
    activate(context);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('reactify-tsx.extractArrowFunction'));
    assert.ok(commands.includes('reactify-tsx.transformFunction'));
    assert.ok(commands.includes('reactify-tsx.flipIfElse'));
    assert.ok(commands.includes('reactify-tsx.enumToConst'));
    assert.ok(commands.includes('reactify-tsx.convertToLet'));
    assert.ok(commands.includes('reactify-tsx.convertToConst'));
    assert.ok(commands.includes('reactify-tsx.moveBlockUp'));
    assert.ok(commands.includes('reactify-tsx.moveBlockDown'));
    assert.ok(commands.includes('reactify-tsx.toggleJsxAttributeValue'));
    assert.ok(commands.includes('reactify-tsx.toggleStringTemplate'));
    assert.ok(commands.includes('reactify-tsx.removeRedundantElse'));
    assert.ok(commands.includes('reactify-tsx.parallelizeAwaitSelection'));
    assert.ok(commands.includes('reactify-tsx.wrapWithUseCallback'));
  });

  test('allows repeated activation without duplicate registration', () => {
    const firstContext = createContext();
    contexts.push(firstContext);
    activate(firstContext);

    const secondContext = createContext();
    contexts.push(secondContext);

    assert.doesNotThrow(() => activate(secondContext));
  });

  function createContext(): vscode.ExtensionContext {
    return { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
  }
});

