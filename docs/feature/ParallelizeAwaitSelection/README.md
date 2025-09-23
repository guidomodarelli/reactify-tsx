# Parallelize Await Selection

## Purpose

Turn a consecutive run of `await` assignments into a single destructuring assignment that uses `Promise.all`, so that the selected asynchronous operations execute in parallel instead of sequentially.

## Use cases

- Speed up data loading code that retrieves multiple independent resources before rendering a component or constructing a response.
- Consolidate similar `await` declarations to reduce duplication and keep related fetches in a single block.
- Provide a quick safety check when reviewing code: if the command reports the selection as unsupported, you know the statements are coupled or structurally incompatible with parallel execution.

## Code examples

```ts
// Before
const user = await loadUser();
const account = await loadAccount();
const audit = await loadAuditTrail();

// After
const [user, account, audit] = await Promise.all([
    loadUser(),
    loadAccount(),
    loadAuditTrail()
]);
```

## Technical considerations

- Works on a selection of at least two `const` or `let` declarations where each declaration has exactly one identifier and the initializer is an `await` expression.
- All declarations in the selection must use the same variable kind; mixed `const` and `let` statements surface an unsupported warning so that you can harmonise the declarations first.
- Destructured bindings and explicit type annotations are not rewritten yet. Convert them to single identifiers (and add explicit tuple typings afterwards if needed).
- The generated `Promise.all` destructuring preserves the existing indentation and leaves the caret at the start of the new statement for immediate follow-up edits.
- Because the transformation assumes the awaited calls are side-effect free and independent, review the result to ensure parallel execution does not break ordering guarantees in your code.