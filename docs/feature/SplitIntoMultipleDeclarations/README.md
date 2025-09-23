# Split Into Multiple Declarations

## Purpose

Normalize variable statements that declare multiple bindings into a sequence of single-binding declarations to improve readability and simplify further edits.

## Use Cases

- Expand `let a = 1, b = 2;` into:
  ```ts
  let a = 1;
  let b = 2;
  ```
- Expand mixed initialized/uninitialized lists like `var x, y = f();` into two standalone statements.

## Code Examples

Input:

```ts
const x = 1, y = 2;
use(x, y);
```

Result:

```ts
const x = 1;
const y = 2;
use(x, y);
```

## Technical Considerations

- Supported only when all declarators use simple identifiers (no destructuring) and the list has more than one declarator.
- Keeps the original declaration kind (`var`, `let`, or `const`).
- Preserves the current line indentation for newly created lines.

