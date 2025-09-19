# Reactify TSX

Reactify TSX is a VS Code extension that streamlines common React and TypeScript refactors. It automates event handler extraction and lets you convert functions between declarations, expressions, and arrows while preserving bodies, modifiers, and type information as much as possible.

## Feature Index

- [Extract Arrow Function to Handler](docs/feature/ExtractArrowFunction/README.md) - Lift inline JSX arrow functions into named handlers and keep wiring intact.
- [Function Transformation](docs/feature/TransformFunction/README.md) - Convert between arrow functions, function expressions, and declarations with guardrails.
- [Flip If/Else Branches](docs/feature/FlipIfElse/README.md) - Negate the condition and swap `if`/`else` bodies while keeping control-flow intact.
- [Scoped Block Movement](docs/feature/ScopedBlockMovement/README.md) - Move compound statements within their parent scope without crossing boundaries.

## Commands & Keybindings

| Command ID | Title | Default Shortcut |
| --- | --- | --- |
| `reactify-tsx.extractArrowFunction` | Reactify TSX: Extract Arrow Function to Handler | `Ctrl+Alt+Shift+E` (`Cmd+Alt+Shift+E` on macOS) |
| `reactify-tsx.transformFunction` | Reactify TSX: Transform Function | `Ctrl+Alt+Shift+T` (`Cmd+Alt+Shift+T` on macOS) |
| `reactify-tsx.flipIfElse` | Reactify TSX: Flip If/Else Branches | `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` on macOS) |
| `reactify-tsx.moveBlockUp` | Reactify TSX: Move Block Up | `Ctrl+Up` (`Cmd+Ctrl+Up` on macOS) |
| `reactify-tsx.moveBlockDown` | Reactify TSX: Move Block Down | `Ctrl+Down` (`Cmd+Ctrl+Down` on macOS) |

All commands are available from the editor context menu and refactor sub-menu when editing JavaScript or TypeScript (including React variants).

## Function Transformation Options

When you invoke **Transform Function** the extension analyses the selection and offers only the transformations that are valid in that context. Depending on the conversion it may ask for an explicit function name and will suggest a placeholder if one cannot be inferred. If you accept the placeholder, the generated code is annotated with `// FIXME: rename` so you can revisit it quickly.

## Warnings & Annotations

- **Binding changes** – Converting between `function` and arrow syntax can change how `this`, `arguments`, or `super` behave. The extension displays a confirmation dialog whenever the target function references any of those.
- **Type review** – If a variable declaration loses an explicit function type during conversion, the generated declaration receives `// FIXME: review types` and the command surfaces a follow-up warning.

## Development

Install dependencies and build artifacts:

```bash
npm install
npm run compile
```

### Testing

Compile the tests, run the automated suite, and lint the sources:

```bash
npm run compile-tests
npm test
npm run lint
```

The automated tests cover the transformation planner and verify that extension commands are registered.

## Release Notes

- Initial release: arrow-function extraction command and function transformation tooling with safety checks and automated annotations.

---

Enjoy using Reactify TSX! Feel free to file issues or feature requests to help shape future iterations.


