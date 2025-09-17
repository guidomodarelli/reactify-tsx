export const NO_ACTIVE_EDITOR_MESSAGE = 'No active editor found.';
export const EXTRACTION_FAILED_MESSAGE = 'Could not apply refactor changes.';
export const RENAME_COMMAND_ID = 'editor.action.rename';
export const RENAME_ACTION_ERROR = 'Could not initiate rename action:';
export const TEST_SUITE_START_MESSAGE = 'Start all tests.';

export const extractionSuccessMessage = (handlerName: string): string =>
  `Function '${handlerName}' extracted successfully.`;
