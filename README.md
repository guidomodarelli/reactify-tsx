# Reactify TSX

Reactify TSX is a VS Code extension that streamlines common React and TypeScript refactors. It automates event handler extraction and lets you convert functions between declarations, expressions, and arrows while preserving bodies, modifiers, and type information as much as possible.

## Features

- **Extract Arrow Function to Handler** – Move inline JSX arrow functions into surrounding components and wire them up automatically.
- **Convert Functions Between Forms** – Transform functions in either direction:
  - Arrow ⇄ anonymous function expression
  - Variable (arrow or anonymous expression) ⇄ named function declaration
  - Function declaration ⇄ variable assigned to arrow or anonymous function expression
- **Safety Nets** – The refactors preserve `async`, generators, exports, and type parameters. When conversion could change `this`/`arguments`/`super` binding, the extension prompts you before applying the edit. If a type annotation cannot be preserved, it emits `// FIXME: review types` and flags a follow-up warning.

## Commands & Keybindings

| Command ID | Title | Default Shortcut |
| --- | --- | --- |
| `reactify-tsx.extractArrowFunction` | Reactify TSX: Extraer arrow function a handler | `Ctrl+Alt+Shift+E` (`Cmd+Alt+Shift+E` on macOS) |
| `reactify-tsx.transformFunction` | Reactify TSX: Convertir función | `Ctrl+Alt+Shift+T` (`Cmd+Alt+Shift+T` on macOS) |

Both commands are available from the editor context menu when editing JavaScript or TypeScript (including React variants).

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
