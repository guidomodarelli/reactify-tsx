export const NO_ACTIVE_EDITOR_MESSAGE = 'No active editor found.';
export const EXTRACTION_FAILED_MESSAGE = 'Could not apply refactor changes.';
export const RENAME_COMMAND_ID = 'editor.action.rename';
export const RENAME_ACTION_ERROR = 'Could not initiate rename action:';
export const TEST_SUITE_START_MESSAGE = 'Start all tests.';
export const SELECT_ARROW_FUNCTION_MESSAGE = 'Select an arrow function inside a JSX property to extract it.';
export const MISSING_COMPONENT_CONTEXT_MESSAGE = 'No containing React component found.';
export const UNSUPPORTED_COMPONENT_CONTEXT_MESSAGE =
  'Currently only functional components with block body are supported.';
export const INSERTION_TARGET_ERROR_MESSAGE = 'Could not determine where to insert the new function.';

export const extractionSuccessMessage = (handlerName: string): string =>
  `Function '${handlerName}' extracted successfully.`;
