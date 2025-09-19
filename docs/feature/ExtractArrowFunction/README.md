# Extract Arrow Function to Handler

## Purpose
- Promote maintainable React components by lifting inline JSX arrow functions into named handlers without manual editing.
- Preserve existing component semantics (binding, parameter list, body) while wiring the new handler back to the original JSX attribute.

## Use Cases
- Refactor verbose inline event handlers into reusable functions during component cleanup.
- Prepare handlers for reuse across multiple elements or for unit testing in isolation.
- Reduce unnecessary re-renders caused by recreating arrow functions inside JSX on each render cycle.

## Code Examples

### Before
```tsx
export function TodoItem({ onToggle, todo }: Props) {
  return (
    <li onClick={(event) => onToggle(todo.id, event)}> {todo.label} </li>
  );
}
```

### After
```tsx
export function TodoItem({ onToggle, todo }: Props) {
  const handleToggle = (event: React.MouseEvent<HTMLLIElement>) => {
    onToggle(todo.id, event);
  };

  return (
    <li onClick={handleToggle}> {todo.label} </li>
  );
}
```

The extension selects an inline arrow function inside a JSX attribute, generates a handler (`handleToggle` above), and swaps the attribute value to reference the handler.

## Technical Considerations
- Supported contexts include class components and function components with block bodies. Stateless components that return JSX directly must be wrapped in a block before extraction.
- Handler names are derived from the JSX attribute and surrounding component; conflicts are resolved with incremental suffixes.
- Event parameter types are inferred when possible. If a type cannot be resolved the handler remains unannotated and existing type information is preserved.
- After applying the edit the command triggers VS Code's rename input so you can immediately rename the generated handler if desired.
- If the extension cannot locate a valid arrow function or insertion point it surfaces an explicit error message and leaves the document untouched.
