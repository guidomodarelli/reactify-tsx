# Flip If/Else Branches

## Purpose
- Invert conditional branches quickly so the `if` condition describes the positive path you want to highlight.
- Reduce nested logic when the `else` case contains the "happy path" and should become the primary branch.
- Encourage expressive control flow without manual edits and copy/paste mistakes.

## Use Cases
- Rewriting guards so the preferred outcome appears in the first branch while the fallback moves to the `else` block.
- Adjusting readability after introducing early returns; flip the branches and drop the now-redundant `else`.
- Standardizing truthy checks (e.g., converting `if (!isReady)` followed by an `else` into a guard clause pattern).

## Code Examples

### Before
```tsx
if (isLoading) {
  return <Spinner />;
} else {
  return <TaskList tasks={tasks} />;
}
```

### After
```tsx
if (!isLoading) {
  return <TaskList tasks={tasks} />;
}

return <Spinner />;
```

The transformation swaps both branches and negates the original condition. When the `if` branch ends with a terminating statement (`return`, `throw`, `continue`, `break`) the command removes the redundant `else` wrapper to keep the code flat.

## Technical Considerations
- Works on `if` statements that contain both `if` and `else` bodies; `else if` chains must be rewritten manually before flipping.
- Negation follows De Morgan rules for logical `&&` / `||` expressions and preserves parentheses to avoid precedence changes.
- Maintains existing comments within each branch and keeps trailing comments attached to the statement that follows the refactor.
- Aborts with a warning if the statement relies on constructs that cannot be safely negated (e.g., optional chaining with assignments).
