# AGENTS.md — Master Prompt (TDD-first)

> **Purpose**: Configure the agent/LLM to **work strictly with TDD** (Test-Driven Development) in *every* task (feature, bugfix, significant refactor, or functional change), always writing the failing test first and then the minimal code to make it pass. Additionally, maintain **living documentation**: organize the documentation such that the **main README** provides a global explanation of the Visual Studio Code extension, serving as an **index or glossary** referencing the specific documentation for each important feature (see structure below). Update the README only when **new features** are introduced or when **non-trivial logic/design decisions** need to be explained for better code comprehension. **Additionally, always update and maintain the table of commands & keybindings in the README whenever commands or shortcuts change, are added, or removed. When updating this table, review the `package.json` file under `contributes.keybindings` to ensure all entries are current and complete.**

> **Important**: All code, tests, documentation, comments, and README content must be written **exclusively in English**.

---

## Documentation Structure

1. Each relevant feature must have its own folder under `docs/feature`.
   * Example: for the **FlipIfElse** feature, the path will be:
   ```
   docs/feature/FlipIfElse/README.md
   ```
2. In each feature folder, the `README.md` file must contain all necessary information to understand that functionality in detail:
   * Purpose
   * Use cases
   * Code examples (if applicable)
   * Technical considerations
3. The **main README** must maintain an index with links to each documented feature, functioning as the entry point to the documentation, and should offer a global explanation of what the extension does. **It must also include and update a table of commands & keybindings covering all available commands, their descriptions, and shortcut bindings (this table should be assembled and revised according to the contents of `package.json`'s `contributes.keybindings` array).**

### ✅ What to document
* New features
* Important changes to functionality
* Changes in behavior
* **Updates to commands & keybindings** (refer to `package.json` > `contributes.keybindings` for the authoritative list)

### ❌ What not to document
* Bug fixes or minor corrections (as they do not constitute functional changes)

---

## Instructions for the LLM

1. **Mandatory TDD mode** for all functional changes:

   * **Write a failing test first** that demonstrates the desired behavior or reproduces the bug.
   * Run the test suite, **observe the failure**, and briefly explain the failure cause (1–2 lines).
   * **Implement the minimal code** to make the test pass (no premature optimization).
   * **Refactor** as needed, keeping all tests green.
   * Repeat until acceptance criteria are met.

2. **Testing Expert Process & Best Practices**:

   * Begin each testing task by outlining a concise preparation checklist (3–7 items) covering conceptual steps for test design, with emphasis on clarity and coverage.
   * Select an appropriate testing framework for the project, such as Jest, and configure necessary mocks and stubs for isolation.
   * When creating mocks, place them inside a `__mocks__` sibling folder to the file being mocked.
   * Achieve coverage for happy paths, error cases, and edge conditions, defensively validating atypical scenarios.
   * Place test files near their corresponding implementation files, using `.test` in the filename, and use clear naming conventions for files and test cases. Structure suites with `describe` and `it`/`test` blocks with expressive comments.
   * Ensure tests are independent, reproducible, and minimize shared state. Employ mocks and spies for all external dependencies (APIs, databases, etc.), using the `__mocks__` structure as described above.
   * Avoid complex logic inside test code and adopt TDD/BDD styles and explicit code examples where feasible.
   * For TypeScript projects, do not use `any` types. Define precise types as needed, but import existing types from libraries directly. All code, identifiers, comments, and docs must be in English only.
   * Deliver fully runnable, functional test code. Accompany each testing block with a brief explanation and suggest future enhancements for coverage. After delivering, validate that all requirements (coverage, quality, setup, structure) have been satisfied. If any part can't be automated (due to dependencies or infrastructure), clearly document the limitation and suggest a manual workaround in an `Error` section.

3. **Scope**:

   * Applies to **features**, **bugfixes**, **public-facing refactors** (APIs/interfaces), and **relevant architectural changes**.
   * **Trivial fixes** (e.g., undefined variable access, typos, minor messages) **do not require documentation** beyond the test itself (if applicable).

4. **Documentation**:

   * **README.md**: Must serve as a high-level overview of the extension and an index to feature documentation. **It must also have a current, clear, and complete table of commands & keybindings, updated with each change to these commands or shortcuts. To accurately maintain this table, inspect `package.json`'s `contributes.keybindings` section.**
   * **Feature documentation**: Place in `docs/feature/{FeatureName}/README.md`, covering purpose, use cases, code examples, and technical considerations of each feature.
   * **Do not** use the README for bugfix history or issue tracking. Those must live in the **tests**.

5. **Expected output per task** (in order):

   1. **New or updated test(s)** (initially failing) with short explanation and, when authoring new tests (as a testing expert), following the outlined process checklist for design and implementation.
   2. **Minimal implementation** to pass the test(s).
   3. **Test execution** (all green) and, if needed, **refactor**.
   4. **README update** (only if applicable, always for new/changed commands/keybindings based on `package.json`'s `contributes.keybindings`).
   5. **Concise summary** of major changes (1–3 bullets) and rationale.

6. **Acceptance checklist**:

   *

7. **Test conventions**:

   * Descriptive names: *“should do X when Y”.*
   * Follow *Arrange–Act–Assert* or *Given–When–Then*.
   * Include **happy path** and **significant edge cases**.
   * For regressions, include a **regression test** that fails before the fix.
   * Use TypeScript types precisely; import types from libraries, avoid `any`.
   * Organize mocks in `__mocks__` as appropriate.
   * Structure blocks as `describe`/`it` or `describe`/`test` with explanatory comments.
   * Ensure all tests are independent and avoid shared state.
   * Place test files adjacent to the code (e.g., `example.test.ts` next to `example.ts`).
   * Include a brief commentary block to explain test coverage and suggest further enhancements.
   * Include a validation paragraph at the end to confirm coverage, correctness, and to call out any gaps or manual steps required. If some code cannot be tested automatically, document it in an Error section with a suggested manual workaround.

8. **Commit/PR policy (summary)**:

   * Small commits with messages: *"test: …"*, *"feat: …"*, *"fix: …"*, *"docs: …"*.
   * PR must show: red tests → implementation → green tests → docs (if applicable).

---

## Naming & structure conventions

* **No single-letter variable names** except conventional cases (`i`, `j`, `k` for loop counters; `x`, `y`, `z` in mathematics).
  * ✅ `let count = 0;`, `for (let i = 0; i < n; i++) { ... }`, `function calculateHypotenuse(x, y) { ... }`
  * ❌ `let c = 0;`, `function doSomething(a, b) { ... }` (unless `a`, `b` are mathematical axis/variables)
* In `try/catch`, **always use `error` or descriptive variants** (like `caughtError`, `dbError`), **never just `e`**.
  * ✅ `catch (error) { ... }`, `catch (dbError) { ... }`
  * ❌ `catch (e) { ... }`
* **Self-explanatory naming** for variables, functions, classes, files, and folders.
  * ✅ `userService`, `getUserProfile`, `UserProfileCard`, `auth-store.js`
  * ❌ `usrSvc`, `gup()`, `card.js`, `s.js`
* **Common folders** are permitted (`utils/`, `services/`, `components/`, `store/`, etc.). If no common folder fits, **use lowercase kebab-case** for the folder name.
  * ✅ `data-fetchers/`, `user-profile-settings/`
  * ❌ `DataFetchers/`, `UserProfileSettings/`, `Profilesettings/`
* **Descriptive file names in kebab-case** only.
  * ✅ `user-profile-card.js`, `auth-store.ts`
  * ❌ `UserProfileCard.js`, `AuthStore.ts`, `upc.js`
* **Barrel files**: create/update an `index.ts`/`index.js` in every folder to re-export public interfaces.
  * ✅ `export * from './user-profile';` in `index.ts`
  * ❌ Files in module folders that are only ever imported directly.

---

## Templates

### 1) Task Template (work prompt)

**Brief context:**

* Problem / Goal:
* Expected behavior (criteria):
* Relevant inputs/outputs:

**TDD Plan:**

1. Write failing test: *[file/path + test name + case]*
2. Run and confirm failure with expected message.
3. Implement minimal solution.
4. Add edge case tests.
5. Refactor with all tests green.
6. Update README or feature documentation **only if** a feature or relevant knowledge is added; **always update commands & keybindings table as needed**.

**Definition of Done (DoD):**

*

---

### 2) Main README Template (suggested sections)
* **Introduction**: overview and entry point to documentation
* **Feature index**: links (as a table or list) to `docs/feature/{FeatureName}/README.md` for each documented feature
* **Main features** (updated when new capabilities are added)
* **Commands & Keybindings**: table listing commands, descriptions, and shortcuts; must be kept updated with each command change
* **Installation / Setup**
* **Quick usage** (minimal snippets)
* **Example calls** (meaningful input/output)
* **Folder structure** (tree with short description per folder)
* **Design notes** (only decisions that aid understanding)
* **FAQs / Minimal troubleshooting** (only if truly useful)

> Avoid: bugfix lists or verbose changelogs; history lives in the **tests**.

---

### 3) Feature Documentation Template
Each feature's folder (`docs/feature/{FeatureName}/README.md`) should include:
* **Purpose**
* **Use cases**
* **Code examples**
* **Technical considerations**

---

### 4) Example folder structure

```
src/
  domain/            # entities, value objects, domain services
  app/               # use cases / orchestrators
  infra/             # adapters, gateways, IO
  ui/                # interfaces/handlers
  shared/            # utilities, types, common errors

tests/
  unit/              # unit tests (1:1 with src)
  integration/       # integration tests
  e2e/               # end–to–end tests (optional)

docs/
  feature/
    FlipIfElse/
      README.md
    ...
```

---

## Mini example (illustrative)

1. **Failing test**

```js
// tests/unit/sum.test.js
it('should add positive numbers', () => {
  expect(sum(2, 3)).toBe(5); // ReferenceError before implementation
});
```

2. **Minimal implementation**

```js
// src/shared/sum.js
export function sum(a, b) { return a + b; }
```

3. **README (only if applicable)**

* Add in *Features*: "Basic arithmetic operations: `sum(a,b)`".
* Add usage snippet if it improves clarity.
* **Add/update entry in commands & keybindings table if a new command/shortcut is introduced**

---

## Best practices

* **Small steps**: one test → minimal code → green → refactor.
* **Useful coverage** > total coverage: focus on observable behavior and relevant edges.
* **Clear names** in modules, functions, and tests.
* **Do not document trivialities**; document what **clarifies**.
* **Keep the commands & keybindings table up to date at all times, referencing `package.json`'s `contributes.keybindings` for accuracy.**

---

## Final reminder

> If there is no failing test, **do not start** implementation. If the modification does not create/expose a new capability or relevant knowledge, **do not touch the README**, **except when command or keybinding tables must be updated—they must be checked against `package.json > contributes.keybindings` for completeness and correctness**. The truth of the system lives in the **tests**; the **README** tells how it works and what it offers, and provides a current list of commands & keybindings.
