# Simplify If/Else

**Purpose**

Collapse trivial boolean if/else branches into a single boolean expression without introducing a ternary.

**Use cases**

- `if (flag) return true; else return false;` → `return flag;`
- `if (flag) return false; else return true;` → `return !flag;`
- `if (cond) target = true; else target = false;` → `target = cond;`
- `if (cond) target = false; else target = true;` → `target = !cond;`

**Code examples**

Before:

```ts
function canSubmit(ready: boolean) {
  if (ready) {
    return true;
  } else {
    return false;
  }
}
```

After:

```ts
function canSubmit(ready: boolean) {
  return ready;
}
```

Assignments:

```ts
if (isOpen) {
  visible = false;
} else {
  visible = true;
}
```

becomes

```ts
visible = !isOpen;
```

**Technical considerations**

- Supports only boolean-return and boolean-assignment branches.
- Else-if chains are not simplified.
- The service preserves parentheses where needed and removes double negations.
- For identical boolean values on both branches, it collapses to a constant return/assignment.

