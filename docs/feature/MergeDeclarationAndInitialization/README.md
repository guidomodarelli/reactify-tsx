# Merge Declaration and Initialization

## Purpose

Combine a standalone variable declaration (without initializer) and the immediately following assignment into a single initialized declaration. This tidies code and reduces cognitive load by keeping the variable’s definition and initial value in one place.

## Use Cases

- Clean up sequences like `let value; value = compute();` → `let value = compute();`.
- Normalize code produced by refactors that temporarily split declaration and initialization.
- Simplify `var`/`let` declarations when the next line assigns the initial value.

## Examples

Input:

```ts
let value;
value = compute();
use(value);
```

Output:

```ts
let value = compute();
use(value);
```

`var` is also supported:

```ts
var x;
x = 1;
// becomes
var x = 1;
```

## Technical Considerations

- Only merges when the declaration is a single identifier without an initializer and the next statement is a simple assignment to that same identifier using `=`.
- `const` declarations are not applicable (they cannot be uninitialized).
- The merge preserves the original declaration kind (`var` or `let`) and indentation of the declaration line.
- Comments and complex scenarios (e.g., destructuring or non-adjacent statements) are not merged by this initial version.

