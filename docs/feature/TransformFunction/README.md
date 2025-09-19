# Function Transformation

## Purpose
- Provide guided conversions between React/TypeScript function syntaxes directly from the editor.
- Maintain modifiers (`async`, `export`, generators, type parameters) while adjusting the target structure.
- Surface safety warnings whenever a transformation could alter lexical bindings or drop type information.

## Use Cases
- Convert an inline arrow function into a named declaration before sharing it across modules.
- Collapse a verbose `function` into a concise arrow expression for readability when no `this` usage exists.
- Move between variable-based declarations and named declarations to satisfy linting or codebase conventions.

## Code Examples

### Arrow (variable) → Function declaration
```ts
const saveUser = async (input: User) => {
  return apiClient.save(input);
};
```
becomes
```ts
export async function saveUser(input: User) {
  return apiClient.save(input);
}
```

### Function declaration → Arrow (variable)
```ts
function renderItem(item: Item): JSX.Element {
  return <ItemCard item={item} />;
}
```
becomes
```ts
const renderItem = (item: Item): JSX.Element => {
  return <ItemCard item={item} />;
};
```

### Function expression ↔ Arrow
```ts
const comparator = function (left: number, right: number) {
  return left - right;
};
```
becomes
```ts
const comparator = (left: number, right: number) => {
  return left - right;
};
```

## Technical Considerations
- The command analyses the current selection to locate the nearest function node (arrow, function expression, or declaration). If none is found the command exits with an informational message.
- The quick pick presents only valid transformations for the selected context. For example, only variables backed by functions can become declarations.
- When converting unnamed declarations to variables the command prompts for a function name. Accepting the suggested placeholder adds `// FIXME: rename` to the generated code.
- If a transformation could alter `this`, `arguments`, or `super` behavior, a modal warning requires explicit confirmation before applying edits.
- After edits are applied the command updates the editor selection to highlight newly injected identifiers when relevant and issues a follow-up warning if manual type review is recommended.
