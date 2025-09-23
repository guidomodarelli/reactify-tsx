# Variable Kind Conversion

Purpose
- Change variable declaration kind between `var`/`const` → `let` and `var`/`let` → `const`.

Use cases
- Normalize legacy code by replacing `var` or overly strict `const` with `let`.
- Strengthen immutability guarantees by converting eligible `let` declarations to `const`.

Code examples
```ts
// To let
var count = 1; // select within the declaration
// => let count = 1;

const name = 'x';
// => let name = 'x';

// To const (only when safe)
let total = compute();
// => const total = compute();
```

Technical considerations
- Conversion to `const` requires that every declared identifier is a simple identifier with an initializer and that no subsequent writes are detected in the file (assignments or ++/--). Destructuring and complex patterns are not yet supported.
- The edit replaces the entire variable statement to ensure correct formatting and modifiers are preserved.
- Available via the editor context menu, Quick Fix/Refactor, and dedicated keybindings.

