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

export const NO_FUNCTION_IN_SELECTION_MESSAGE = 'No function found at the current selection.';
export const NO_AVAILABLE_TRANSFORMATIONS_MESSAGE =
  'No compatible transformations are available for the selected function.';
export const SELECT_TRANSFORMATION_PLACEHOLDER = 'Select a function transformation target';
export const TRANSFORMATION_SUCCESS_MESSAGE = 'Function transformed successfully.';
export const TRANSFORMATION_APPLY_FAILURE_MESSAGE = 'Could not apply transformation changes.';
export const TRANSFORMATION_BINDING_WARNING_MESSAGE =
  'This conversion may change how "this", "arguments" or "super" behave. Continue?';
export const TRANSFORMATION_CONTINUE_ACTION = 'Continue';
export const TRANSFORMATION_CANCEL_ACTION = 'Cancel';
export const TRANSFORMATION_TYPES_REVIEW_MESSAGE = 'Review the generated // FIXME: review types annotations.';
export const REQUEST_FUNCTION_NAME_PROMPT = 'Provide a name for the generated function.';
export const INVALID_IDENTIFIER_MESSAGE = 'Enter a valid JavaScript identifier.';

export const TRANSFORMATION_NOT_IMPLEMENTED_MESSAGE = 'Transformation not implemented.';
export const NOT_AN_ARROW_FUNCTION_MESSAGE = 'Selected node is not an arrow function.';
export const NOT_A_FUNCTION_EXPRESSION_MESSAGE = 'Selected node is not a function expression.';
export const NOT_A_FUNCTION_DECLARATION_MESSAGE = 'Selected node is not a function declaration.';
export const GENERATOR_ARROW_UNSUPPORTED_MESSAGE = 'Cannot convert generator functions to arrow functions.';
export const ONLY_ANONYMOUS_FUNCTION_SUPPORTED_MESSAGE =
  'Only anonymous function expressions are supported for this conversion.';
export const NOT_IN_VARIABLE_DECLARATION_MESSAGE = 'Function is not part of a variable declaration.';
export const ONLY_IDENTIFIER_DECLARATIONS_SUPPORTED_MESSAGE =
  'Only simple identifier declarations are supported.';
export const DECLARATION_MISSING_INITIALIZER_MESSAGE = 'Variable declaration has no initializer.';
export const EXPECTED_ARROW_INITIALIZER_MESSAGE = 'Expected arrow function initializer for conversion.';
export const EXPECTED_FUNCTION_EXPRESSION_INITIALIZER_MESSAGE =
  'Expected function expression initializer for conversion.';
export const FUNCTION_MISSING_IMPLEMENTATION_MESSAGE =
  'Function declaration without implementation cannot be transformed.';
export const FUNCTION_NAME_REQUIRED_MESSAGE = 'Function declaration must have a name for this conversion.';
export const FUNCTION_UNSUPPORTED_MODIFIER_MESSAGE =
  'Function has modifiers that are not supported for conversion.';

export const extractionSuccessMessage = (handlerName: string): string =>
  `Function '${handlerName}' extracted successfully.`;

export const NO_IF_STATEMENT_IN_SELECTION_MESSAGE = 'No if/else statement found at the current selection.';
export const IF_STATEMENT_REQUIRES_ELSE_MESSAGE = 'Selected if statement must include an else branch to flip it.';
export const IF_ELSE_FLIP_UNSUPPORTED_MESSAGE = 'Selected if statement is not supported for flipping.';
export const IF_ELSE_FLIP_APPLY_FAILURE_MESSAGE = 'Could not apply flip changes.';
export const IF_ELSE_FLIP_SUCCESS_MESSAGE = 'If/else logic flipped successfully.';
export const NO_MOVABLE_BLOCK_MESSAGE = 'No movable block found at the current selection.';
export const BLOCK_MOVE_AT_TOP_MESSAGE = 'Block is already at the top of its scope.';
export const BLOCK_MOVE_AT_BOTTOM_MESSAGE = 'Block is already at the bottom of its scope.';
export const BLOCK_MOVE_APPLY_FAILURE_MESSAGE = 'Could not apply block movement.';
export const NO_ENUM_IN_SELECTION_MESSAGE = 'No enum declaration found at the current selection.';
export const ENUM_CONVERSION_UNSUPPORTED_MESSAGE = 'Selected enum cannot be converted to a const object.';
export const ENUM_CONVERSION_APPLY_FAILURE_MESSAGE = 'Could not apply enum conversion changes.';
export const ENUM_CONVERSION_SUCCESS_MESSAGE = 'Enum converted to const object successfully.';
