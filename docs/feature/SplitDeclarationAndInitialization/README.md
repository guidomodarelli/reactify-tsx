# Split Declaration and Initialization

## Purpose

Separate a single variable declaration into a declaration statement and a subsequent assignment. This can help with hoisting a name or inserting logic between declaration and initialization.

## Use Cases

- Turn `let value = compute();` into:
  ```ts
  let value;
  value = compute();
  ```
- Prepare a name for conditional initialization or for refactoring into different branches.

## Code Examples

Input:

```ts
let result = make();
consume(result);
```

Result:

```ts
let result;
result = make();
consume(result);
```

## Technical Considerations

- Applies only to a single-declarator statement with a simple identifier and an initializer.
- Not available for `const` because a `const` declaration must be initialized.
- Preserves indentation and the original declaration kind (`let` or `var`).

