# Toggle String ⇄ Template Literal

## Purpose

Quickly switch between a regular string literal (single or double quoted) and a no-substitution template literal (backticks) while preserving the original content.

## Use cases

- Prepare a string for future interpolation by converting to a template literal.
- Simplify a backtick literal with no `${...}` expressions back to a plain string.

## Code examples

// Given
const a = 'hello world';
// Toggle →
const a = `hello world`;

// Given
const b = `greeting`;
// Toggle →
const b = 'greeting';

// Unsupported (contains expressions)
// const c = `hi ${name}`; // remains unchanged

## Technical considerations

- The toggle converts only simple cases:
  - String → Template: converts `"..."` or `'...'` to `` `...` `` and escapes backticks and `${` sequences.
  - Template → String: converts only no-substitution templates (no `${...}`) to single-quoted strings, escaping quotes and common control characters.
- Multiline template literals are converted by escaping newlines as `\n` when toggling to a string.
- Place the caret anywhere inside the target literal or select it to run the command.

