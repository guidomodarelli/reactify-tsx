# Simplify Ternary

- Purpose: simplify conditional (`?:`) expressions when it is provably safe.
- Scope: replaces selected ternaries with a simpler boolean or the shared branch expression.

## Purpose

Cut redundant ternary syntax where the result is either a boolean literal or both branches are the same expression. The simplification is semantics-preserving and avoids rewriting to `||`/`&&` patterns that could change types.

## Use cases

- Convert `cond ? true : false` to `!!cond` to preserve boolean typing.
- Convert `cond ? false : true` to `!cond`.
- Collapse identical branches: `cond ? render() : render()` ➜ `render()` (works with JSX too).

## Code examples

```ts
// Before
return ready ? true : false;
// After
return !!ready;

// Before
const disabled = isBusy ? false : true;
// After
const disabled = !isBusy;

// Before
return show ? <Item/> : <Item/>;
// After
return <Item/>;
```

## Technical considerations

- The refactor parses with TSX/JSX mode when needed so JSX branches are preserved.
- For `true/false` arms it emits `!!condition` (not bare `condition`) to keep the boolean result.
- Negation uses parentheses when required to maintain operator precedence.
- The action only triggers when:
  - Both branches are boolean literals, or
  - Both branches are syntactically identical (whitespace-insensitive).
- It intentionally does not fold numeric or mixed-type arms.

---

Trigger via Quick Fix (Ctrl+.) when the caret selection covers a ternary expression that fits the rules.
