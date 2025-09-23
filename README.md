# Reactify TSX

Reactify TSX is a VS Code extension that streamlines common React and TypeScript refactors. It automates event handler extraction and lets you convert functions between declarations, expressions, and arrows while preserving bodies, modifiers, and type information as much as possible.

## Feature Index

- [Extract Arrow Function to Handler](docs/feature/ExtractArrowFunction/README.md) - Lift inline JSX arrow functions into named handlers and keep wiring intact.
- [Function Transformation](docs/feature/TransformFunction/README.md) - Convert between arrow functions, function expressions, and declarations with guardrails.
- [Flip If/Else Branches](docs/feature/FlipIfElse/README.md) - Negate the condition and swap `if`/`else` bodies while keeping control-flow intact.
- [Remove Redundant Else](docs/feature/RemoveRedundantElse/README.md) - Drop `else` branches when the guarded path already exits.
- [Parallelize Await Selection](docs/feature/ParallelizeAwaitSelection/README.md) - Combine sequential await declarations into a single `Promise.all` for parallel execution.
- [Enum To Const](docs/feature/EnumToConst/README.md) - Convert enums into immutable const objects plus union types for safer tree-shaken builds.
- [Variable Kind Conversion](docs/feature/VariableKindConversion/README.md) - Convert `var`/`const` to `let` or `var`/`let` to `const` when safe.
- [Scoped Block Movement](docs/feature/ScopedBlockMovement/README.md) - Move compound statements within their parent scope without crossing boundaries.
- [Toggle JSX Attribute Braces](docs/feature/ToggleJsxAttributeBraces/README.md) - Toggle string literal attribute values between bare literals and brace expressions.
- [Toggle String ⇄ Template Literal](docs/feature/ToggleStringTemplate/README.md) - Switch between plain strings and backtick template literals when no expressions are present.
- [Split Into Multiple Declarations](docs/feature/SplitIntoMultipleDeclarations/README.md) - Expand multi-declarator statements into one declaration per line.
- [Split Declaration and Initialization](docs/feature/SplitDeclarationAndInitialization/README.md) - Separate a declaration with initializer into a declaration and a following assignment.
- [Merge Declaration and Initialization](docs/feature/MergeDeclarationAndInitialization/README.md) - Combine a standalone declaration and the immediately following assignment into a single initialized declaration.
- [Split or Merge String](docs/feature/SplitOrMergeString/README.md) - Split a quoted string at the caret or merge a + chain of adjacent string literals.
- [Toggle Arrow Body](docs/feature/ToggleArrowBody/README.md) - Convert between shorthand expression and block bodies for arrow functions.
- [Add Parens to Single Arrow Parameter](docs/feature/AddParensToSingleArrowParam/README.md) - Wrap single arrow parameter identifiers with parentheses.

## Commands & Keybindings

| Command ID | Title | Default Shortcut |
| --- | --- | --- |
| `reactify-tsx.extractArrowFunction` | Reactify TSX: Extract Arrow Function to Handler | `Ctrl+Alt+Shift+E` (`Cmd+Alt+Shift+E` on macOS) |
| `reactify-tsx.transformFunction` | Reactify TSX: Transform Function | `Ctrl+Alt+Shift+T` (`Cmd+Alt+Shift+T` on macOS) |
| `reactify-tsx.flipIfElse` | Reactify TSX: Flip If/Else Branches | `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` on macOS) |
| `reactify-tsx.removeRedundantElse` | Reactify TSX: Remove Redundant Else | `Ctrl+Alt+Shift+R` (`Cmd+Alt+Shift+R` on macOS) |
| `reactify-tsx.parallelizeAwaitSelection` | Reactify TSX: Parallelize Await Selection | `Ctrl+Alt+Shift+W` (`Cmd+Alt+Shift+W` on macOS) |
| `reactify-tsx.convertToLet` | Reactify TSX: Convert Declaration to let | `Ctrl+Alt+Shift+L` (`Cmd+Alt+Shift+L` on macOS) |
| `reactify-tsx.convertToConst` | Reactify TSX: Convert Declaration to const | `Ctrl+Alt+Shift+O` (`Cmd+Alt+Shift+O` on macOS) |
| `reactify-tsx.moveBlockUp` | Reactify TSX: Move Block Up | `Ctrl+Up` (`Cmd+Ctrl+Up` on macOS) |
| `reactify-tsx.moveBlockDown` | Reactify TSX: Move Block Down | `Ctrl+Down` (`Cmd+Ctrl+Down` on macOS) |
| `reactify-tsx.enumToConst` | Reactify TSX: Convert Enum to Const | `Ctrl+Alt+Shift+C` (`Cmd+Alt+Shift+C` on macOS) |
| `reactify-tsx.toggleJsxAttributeValue` | Reactify TSX: Toggle JSX Attribute Braces | `Ctrl+Alt+Shift+B` (`Cmd+Alt+Shift+B` on macOS) |
| `reactify-tsx.toggleStringTemplate` | Reactify TSX: Toggle String <-> Template Literal | `Ctrl+Alt+Shift+Q` (`Cmd+Alt+Shift+Q` on macOS) |
| `reactify-tsx.toggleArrowBody` | Reactify TSX: Toggle Arrow Body (Expression -> Block) | `Ctrl+Alt+Shift+A` (`Cmd+Alt+Shift+A` on macOS) |
| `reactify-tsx.addParensToSingleArrowParam` | Reactify TSX: Add Parens to Single Arrow Parameter | `Ctrl+Alt+Shift+P` (`Cmd+Alt+Shift+P` on macOS) |
| `reactify-tsx.splitIntoMultipleDeclarations` | Reactify TSX: Split Into Multiple Declarations | `Ctrl+Alt+Shift+M` (`Cmd+Alt+Shift+M` on macOS) |
| `reactify-tsx.splitDeclarationAndInitialization` | Reactify TSX: Split Declaration and Initialization | `Ctrl+Alt+Shift+D` (`Cmd+Alt+Shift+D` on macOS) |
| `reactify-tsx.mergeDeclarationAndInitialization` | Reactify TSX: Merge Declaration and Initialization | `Ctrl+Alt+Shift+G` (`Cmd+Alt+Shift+G` on macOS) |
| `reactify-tsx.splitOrMergeString` | Reactify TSX: Split String at Caret / Merge String Literals | `Ctrl+Alt+Shift+S` (`Cmd+Alt+Shift+S` on macOS) |

All commands are available from the editor context menu, the Quick Fix (Ctrl+.) panel, and the refactor sub-menu when editing JavaScript or TypeScript (including React variants). Commands that operate on selections still require you to highlight the target code before invoking Quick Fix.

## Function Transformation Options

When you invoke **Transform Function** the extension analyses the selection and offers only the transformations that are valid in that context. Depending on the conversion it may ask for an explicit function name and will suggest a placeholder if one cannot be inferred. If you accept the placeholder, the generated code is annotated with `// FIXME: rename` so you can revisit it quickly.

## Warnings & Annotations

- **Binding changes** - Converting between `function` and arrow syntax can change how `this`, `arguments`, or `super` behave. The extension displays a confirmation dialog whenever the target function references any of those.
- **Type review** - If a variable declaration loses an explicit function type during conversion, the generated declaration receives `// FIXME: review types` and the command surfaces a follow-up warning.

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
