# Merge Nested If

**Purpose**

Merge a nested `if` directly contained in another `if` (with no `else` branches) into a single guard using logical AND (`&&`). This reduces indentation and clarifies the intent of sequential checks.

**Use cases**

- Simplify nested guards:
  - Before:
    ```ts
    if (a) {
      if (b) {
        doIt();
      }
    }
    ```
  - After:
    ```ts
    if (a && b) {
      doIt();
    }
    ```
- Preserve single-statement bodies as-is:
  - Before:
    ```ts
    if (enabled) {
      if (ready)
        run();
    }
    ```
  - After:
    ```ts
    if (enabled && ready)
        run();
    ```

**Technical considerations**

- Only merges when both the outer and direct inner `if` lack `else` branches.
- The direct inner `if` may be the only statement inside the outer block, or be the outer then-branch itself.
- The service parentshesizes complex inner conditions when necessary (e.g., `a && (b || c)`).
- TSX is supported; self-closing JSX tags are normalized to `/>` spacing as `<tag />`.

**Command**

- `reactify-tsx.mergeNestedIf` — available from Quick Fix/Refactor menus and via the default keybinding.

