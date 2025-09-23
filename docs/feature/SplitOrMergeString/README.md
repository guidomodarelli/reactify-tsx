# Split or Merge String

## Purpose

Provide quick string manipulation:
 - Split a quoted string literal at the caret into two adjacent literals concatenated with `+`.
 - Merge a `+` chain of adjacent string literals back into a single literal.

This mirrors editor conveniences found in other IDEs and keeps the original escaping verbatim.

## Use Cases

- Split long strings to satisfy formatting rules or improve readability.
- Join previously split literals when they are no longer necessary.

## Examples

Split at caret inside a string:

```ts
// Caret after the space
const s = 'hello world';
// =>
const s = 'hello ' + 'world';
```

Merge adjacent literals in a `+` chain:

```ts
const s = 'hello ' + 'world' + '!';
// =>
const s = 'hello world!';
```

Quote style is preserved when all parts use the same quotes. Template literals with expressions are not affected.

## Technical Considerations

- The operation preserves source escapes by slicing from the original document text.
- Split currently supports single (`'`) and double (`"`) quoted string literals.
- Merge supports `+` chains composed exclusively of same-quote string literals.
- The command is a no-op when the caret is at the first/last character of the string content.

