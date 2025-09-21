# EnumToConst

## Purpose
Convert TypeScript `enum` declarations into immutable const objects accompanied by a discriminated union type alias. The feature mirrors patterns commonly recommended for tree-shakeable enums in React and TypeScript projects.

## Use cases
- Replace runtime enums with const objects to avoid bundle growth in front-end applications.
- Prepare codebases for environments where `const enum` is disabled while keeping enum-like type safety.
- Migrate shared models to serialisable structures that can be consumed by non-TypeScript tooling.

## Code examples
```ts
// Before
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// After invoking Reactify TSX: Convert Enum to Const
export const Status = {
    Active: 'active',
    Inactive: 'inactive'
} as const;

export type Status = (typeof Status)[keyof typeof Status];
```

```ts
// Before
enum Palette {
  Primary,
  Secondary,
}

// After
const Palette = {
    Primary: 0,
    Secondary: 1
} as const;

type Palette = (typeof Palette)[keyof typeof Palette];
```

## Technical considerations
- Works for enums carrying string literals, numeric literals, and auto-incremented numeric members. Negative numeric literals are supported.
- Ambient (`declare`) and `const` enums are reported as unsupported, because they have incompatible runtime behaviour.
- Computed enum member values (e.g., call expressions) are not converted automatically; the command notifies you when such members are encountered.
- Default-exported enums become a `const` declaration plus `export default` of the generated object to preserve module semantics. Named exports remain untouched.
- Selection must include (or be inside) a single enum declaration. The command rejects partial selections without an enum node.
