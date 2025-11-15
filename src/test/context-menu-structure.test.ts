import * as assert from "assert";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Preparation checklist:
 * - Identify the manifest path and parse it with precise typing.
 * - Enumerate every Reactify TSX context menu command identifier.
 * - Determine the submenu identifier and guard clause for context actions.
 * - Inspect editor/context menu entries to ensure they route through the submenu.
 * - Validate that submenu metadata and membership stay consistent.
 *
 * Coverage notes:
 * - Guards against regressions where context actions bypass the submenu hierarchy.
 * Future enhancements:
 * - Assert ordering/group metadata once VS Code exposes stable snapshots for menus.
 */

interface MenuContribution {
  readonly command?: string;
  readonly submenu?: string;
  readonly when?: string;
  readonly group?: string;
}

interface SubmenuContribution {
  readonly id: string;
  readonly label: string;
  readonly when?: string;
}

interface PackageManifest {
  readonly contributes?: {
    readonly menus?: {
      readonly [key: string]: readonly MenuContribution[];
    };
    readonly submenus?: readonly SubmenuContribution[];
  };
}

const CONTEXT_SUBMENU_ID = "reactify-tsx.contextActions";
const CONTEXT_WHEN_CLAUSE =
  "editorLangId == typescriptreact || editorLangId == javascriptreact || editorLangId == typescript || editorLangId == javascript";
const EXPECTED_CONTEXT_COMMANDS: readonly string[] = [
  "reactify-tsx.extractArrowFunction",
  "reactify-tsx.transformFunction",
  "reactify-tsx.flipIfElse",
  "reactify-tsx.removeRedundantElse",
  "reactify-tsx.parallelizeAwaitSelection",
  "reactify-tsx.convertToLet",
  "reactify-tsx.convertToConst",
  "reactify-tsx.enumToConst",
  "reactify-tsx.toggleJsxAttributeValue",
  "reactify-tsx.splitIntoMultipleDeclarations",
  "reactify-tsx.splitDeclarationAndInitialization",
  "reactify-tsx.mergeDeclarationAndInitialization",
  "reactify-tsx.addParensToSingleArrowParam",
  "reactify-tsx.wrapWithUseCallback",
  "reactify-tsx.replaceIfElseWithTernary",
  "reactify-tsx.simplifyIfElse",
  "reactify-tsx.mergeNestedIf",
];

suite("Context menu hierarchy", () => {
  const manifestPath = path.resolve(__dirname, "..", "..", "package.json");
  const manifestContent = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestContent) as PackageManifest;

  test("should expose only the Reactify TSX submenu in editor context menu", () => {
    const contextMenuEntries = manifest.contributes?.menus?.["editor/context"] ?? [];
    assert.strictEqual(
      contextMenuEntries.length,
      1,
      "editor context menu should contain a single submenu entry for Reactify TSX actions",
    );

    const submenuEntry = contextMenuEntries[0];
    assert.strictEqual(
      submenuEntry.submenu,
      CONTEXT_SUBMENU_ID,
      "editor context menu entry must route to the Reactify TSX submenu",
    );
    assert.strictEqual(
      submenuEntry.when,
      CONTEXT_WHEN_CLAUSE,
      "submenu entry should reuse the original language guard clause",
    );
    assert.ok(
      submenuEntry.group,
      "submenu entry must specify a group to control separators in the context menu",
    );
  });

  test("should register submenu metadata with a descriptive label", () => {
    const submenus = manifest.contributes?.submenus ?? [];
    const submenuDefinition = submenus.find((entry) => entry.id === CONTEXT_SUBMENU_ID);
    assert.ok(submenuDefinition, "Reactify TSX context submenu must be declared under contributes.submenus");
    assert.strictEqual(submenuDefinition?.label, "Reactify TSX", "submenu label should be human-readable");
    assert.strictEqual(
      submenuDefinition?.when,
      CONTEXT_WHEN_CLAUSE,
      "submenu metadata should mirror the editor language guard",
    );
  });

  test("should include every context command under the submenu location", () => {
    const submenuEntries =
      manifest.contributes?.menus?.[`${CONTEXT_SUBMENU_ID}`] ?? [];
    const submenuCommands = submenuEntries.map((entry) => entry.command).filter(Boolean) as string[];

    const missingCommands = EXPECTED_CONTEXT_COMMANDS.filter(
      (commandId) => !submenuCommands.includes(commandId),
    );
    assert.deepStrictEqual(
      missingCommands,
      [],
      missingCommands.length === 0
        ? "expected submenu to include all registered context commands"
        : `reactify submenu missing commands: ${missingCommands.join(", ")}`,
    );

    const unexpectedCommands = submenuCommands.filter(
      (commandId) => !EXPECTED_CONTEXT_COMMANDS.includes(commandId),
    );
    assert.deepStrictEqual(
      unexpectedCommands,
      [],
      unexpectedCommands.length === 0
        ? "submenu should only expose the approved Reactify TSX commands"
        : `unexpected commands contributed: ${unexpectedCommands.join(", ")}`,
    );
  });
});
