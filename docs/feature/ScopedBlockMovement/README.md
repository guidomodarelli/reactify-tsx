# Scoped Block Movement

## Purpose

Allow developers to move compound statements (such as functions, conditionals, and loops) up or down without leaving their containing scope, keeping related code together and reducing manual cut-and-paste steps.

## Use Cases

- Reordering lifecycle hooks or helper functions inside a component without disrupting surrounding declarations.
- Shuffling guard clauses or control-flow branches to surface the most important logic first.
- Grouping related loops and conditionals together while maintaining indentation and scope boundaries.

## Code Examples

### Move a conditional above a variable declaration

Before running `Reactify TSX: Move Block Up`:

```ts
function demo() {
    const before = 1;

    if (value > 0) {
        handlePositive();
    } else {
        handleNonPositive();
    }

    const after = 2;
}
```

After pressing `Ctrl+Up` (or `Cmd+Ctrl+Up` on macOS):

```ts
function demo() {
    if (value > 0) {
        handlePositive();
    } else {
        handleNonPositive();
    }

    const before = 1;

    const after = 2;
}
```

### Move a function declaration downward

```ts
function first() {
    performFirst();
}

function second() {
    performSecond();
}
```

Press `Ctrl+Down` (or `Cmd+Ctrl+Down` on macOS) with the cursor inside `first` to swap their order.

## Technical Considerations

- Movement is limited to siblings within the same block or source file, preventing blocks from escaping their scope.
- Entire statements are swapped, so conditionals travel with their `else` branches and loops keep their bodies intact.
- The command preserves the whitespace that separated the original statements, minimising formatting drift.
- When no eligible block is found or the block is already at the boundary, the extension surfaces an informative message instead of mutating the file.
