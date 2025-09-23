# Add Parens to Single Arrow Parameter

## Purpose

Ensure single-parameter arrow functions use explicit parentheses, e.g. convert `x => x + 1` into `(x) => x + 1`.

## Use Cases

- Enforce a consistent code style where arrow parameters are always parenthesized.
- Prepare a parameter to receive a type annotation later without changing the body.

## Code Examples

Before:

```
const inc = x => x + 1;
```

After:

```
const inc = (x) => x + 1;
```

## Technical Considerations

- Only applies when an arrow function has exactly one parameter and that parameter is a simple identifier.
- If the parameter already has parentheses, the command reports it and makes no changes.
- The edit replaces only the parameter slice, preserving spacing and the function body.

