# Remove Redundant Else

## Purpose

Eliminate redundant `else` branches when the guarded code path already exits via `return`, `throw`, `break`, or `continue`. The refactor flattens the control flow by keeping the `if` guard and hoisting the `else` statements so that the code reads top-down without unnecessary nesting.

## Use Cases

- Simplify React render functions that return early for loading or error states.
- Flatten guards inside event handlers where the happy-path executes only after early returns.
- Reduce indentation depth in loops that continue or break when a guard triggers.

## Code Examples

### Before

```ts
function renderSummary(status: Status) {
  if (status === 'loading') {
    return <Spinner />;
  } else {
    logRender('summary');
    return <Summary />;
  }
}
```

### After

```ts
function renderSummary(status: Status) {
  if (status === 'loading') {
    return <Spinner />;
  }

  logRender('summary');
  return <Summary />;
}
```

## Technical Considerations

- The guard must terminate control flow (`return`, `throw`, `break`, or `continue`). If the guarded block can fall through, the command refuses to run.
- `else if` ladders remain untouched; they are treated as unsupported to avoid altering branching semantics.
- Hoisted statements are re-indented to match the surrounding scope and preserve multi-line constructs and inline comments.
- The command appears in the refactor lightbulb and the Quick Fix menu when the caret is inside a suitable `if` statement.
