# Toggle Arrow Body (Expression ↔ Block)

## Purpose

Quickly switch an arrow function between a shorthand expression body and a block body with an explicit `return`.

## Use Cases

- Expand a concise arrow to a block to add logging or additional statements.
- Collapse a simple block (with a single `return <expr>;`) back to a concise arrow for brevity.

## Examples

Expression → Block:

```ts
const inc = (x: number) => x + 1;
// becomes
const inc = (x: number) => {
  return x + 1;
};
```

Block → Expression (only when there is exactly one `return` statement and it returns an expression):

```ts
const inc = (x: number) => {
  return x + 1;
};
// becomes
const inc = (x: number) => x + 1;
```

## Technical Considerations

- The conversion preserves modifiers, parameters, and type annotations on the arrow function.
- Block → Expression is supported only when the block contains a single `return` with an expression and no other statements.
- The transformation is syntax-aware and regenerates the arrow function from the TypeScript AST, ensuring valid output formatting.

