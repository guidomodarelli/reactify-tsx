# Replace If/Else with Ternary

**Purpose**
- Convert simple `if`/`else` constructs into a concise conditional (ternary) expression.

**Use cases**
- Collapse two return branches into a single `return condition ? A : B;`.
- Replace duplicated assignments to the same target with `target = condition ? A : B;`.

**Code examples**

Input:

```ts
if (isLoading) {
  return <Spinner />;
} else {
  return <Content />;
}
```

Output:

```ts
return isLoading ? <Spinner /> : <Content />;
```

Assignments:

```ts
if (ready) {
  label = getPrimary();
} else {
  label = getFallback();
}
```

becomes

```ts
label = ready ? getPrimary() : getFallback();
```

**Technical considerations**
- Supported shapes only:
  - Both branches are single `return` statements (block or single-line).
  - Both branches are single assignments to the same left-hand side (block or single-line).
- Else-if chains are not converted.
- Branch blocks must contain a single statement; additional statements are not transformed.
- JSX is preserved and normalized to `<Tag />` spacing where applicable.

