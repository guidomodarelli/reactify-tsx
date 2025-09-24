import * as assert from "assert";
import { readFileSync } from "fs";
import * as path from "path";

/**
 * Preparation checklist:
 * - Enumerate the full set of feature command identifiers.
 * - Read the extension manifest safely with precise typing.
 * - Inspect the "editor/codeAction" menu contributions.
 * - Detect commands missing from Quick Fix availability.
 * - Report actionable feedback for missing commands.
 *
 * Coverage notes:
 * - Validates manifest-level Quick Fix availability for all features.
 * Future enhancements:
 * - Exercise integration coverage to confirm code actions surface under realistic selections.
 */

interface MenuContribution {
  readonly command: string;
}

interface PackageManifest {
  readonly contributes?: {
    readonly menus?: {
      readonly [key in "editor/codeAction"]?: readonly MenuContribution[];
    };
  };
}

suite("Quick fix menu contributions", () => {
  const manifestPath = path.resolve(__dirname, "..", "..", "package.json");
  const manifestContent = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestContent) as PackageManifest;

  test("should expose every feature command via Quick Fix menu", () => {
    const codeActionEntries = manifest.contributes?.menus?.["editor/codeAction"] ?? [];
    const expectedCommands: readonly string[] = [
      "reactify-tsx.extractArrowFunction",
      "reactify-tsx.transformFunction",
      "reactify-tsx.flipIfElse",
      "reactify-tsx.enumToConst",
      "reactify-tsx.convertToLet",
      "reactify-tsx.convertToConst",
      "reactify-tsx.moveBlockUp",
      "reactify-tsx.moveBlockDown",
      "reactify-tsx.toggleJsxAttributeValue",
      "reactify-tsx.removeRedundantElse",
      "reactify-tsx.splitIntoMultipleDeclarations",
      "reactify-tsx.splitDeclarationAndInitialization",
      "reactify-tsx.mergeDeclarationAndInitialization",
      "reactify-tsx.wrapWithUseCallback",
    ];

    const missingCommands = expectedCommands.filter(
      (commandId) => !codeActionEntries.some((entry) => entry.command === commandId),
    );

    assert.deepStrictEqual(
      missingCommands,
      [],
      missingCommands.length === 0
        ? "expected Quick Fix menu to include all feature commands"
        : `missing Quick Fix entries for: ${missingCommands.join(", ")}`,
    );
  });
});
