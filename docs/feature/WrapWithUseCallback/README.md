# Wrap Function with useCallback

## Purpose

Wraps a selected arrow or function expression assigned to a variable in a `useCallback` hook, ensuring the handler becomes memoised while preserving the original function body.

## Use cases

- Stabilise event handlers inside React components without manually editing every initializer.
- Quickly convert inline callbacks declared with `const` or `let` into memoised equivalents before passing them to deeply nested props.
- Apply React best practices when extracting handlers out of JSX but still needing stable references.

## Code examples

```tsx
// Before
const handleClick = () => {
  track('click');
};

// After executing Wrap Function with useCallback
const handleClick = useCallback(() => {
  track('click');
}, []);
```

The command augments existing React imports when necessary. For example, `import { useState } from 'react';` becomes `import { useState, useCallback } from 'react';` and new imports are created when none exist.

## Technical considerations

- The command targets simple identifier declarations (`const` or `let`) with arrow or function expression initializers. Multi-declarator statements and destructuring are intentionally excluded.
- If `useCallback` is already present in a React import, the command reuses it; otherwise it adds the specifier or creates a new `import { useCallback } from 'react';` line at the top of the file.
- The generated dependency array defaults to `[]`. Update it manually to reflect actual dependencies after running the command.
- Initializers that are already wrapped in `useCallback` are skipped and surface an informational message instead of duplicating wrappers.
