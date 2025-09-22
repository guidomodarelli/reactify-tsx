# Toggle JSX Attribute Braces

## Purpose
Toggle JSX attribute values between bare string literals and brace-wrapped string expressions so you can quickly prepare for interpolation or normalise to JSX style guidelines.

## Use cases
- Convert `className="primary"` into `className={"primary"}` before replacing the literal with a dynamic expression.
- Remove unnecessary braces from `className={'primary'}` to follow linting rules that forbid redundant JSX expressions.
- Ensure consistent attribute formatting when pairing with automated refactors that expect either literal or brace syntax.

## Code examples
```tsx
// Before
const element = <Button label="primary" />;

// After Reactify TSX: Toggle JSX Attribute Braces
const element = <Button label={"primary"} />;
```

```tsx
// Before
const element = <Button label={'primary'} />;

// After Reactify TSX: Toggle JSX Attribute Braces
const element = <Button label='primary' />;
```

## Technical considerations
- The caret must rest within a JSX attribute (or its selected range) for the command to locate the target initializer.
- Wrapping applies only to attributes backed by string literals or no-substitution template literals.
- Unwrapping is limited to brace expressions whose inner expression is a string literal; other expression kinds remain unchanged and surface an informational warning.
- After applying the change, the command keeps the cursor at the start of the updated attribute for quick follow-up edits.
