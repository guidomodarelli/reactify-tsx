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
export const REDUNDANT_ELSE_NO_BRANCH_MESSAGE =
  'Selected if statement must include an else branch to remove.';
export const REDUNDANT_ELSE_NOT_REDUNDANT_MESSAGE =
  'Else branch cannot be removed because the then branch does not exit control flow.';
export const REDUNDANT_ELSE_UNSUPPORTED_MESSAGE = 'Else-if chains are not supported for redundant else removal.';
export const REDUNDANT_ELSE_APPLY_FAILURE_MESSAGE = 'Could not apply redundant else removal.';
export const REDUNDANT_ELSE_SUCCESS_MESSAGE = 'Removed redundant else branch.';
export const NO_MOVABLE_BLOCK_MESSAGE = 'No movable block found at the current selection.';
export const BLOCK_MOVE_AT_TOP_MESSAGE = 'Block is already at the top of its scope.';
export const BLOCK_MOVE_AT_BOTTOM_MESSAGE = 'Block is already at the bottom of its scope.';
export const BLOCK_MOVE_APPLY_FAILURE_MESSAGE = 'Could not apply block movement.';
export const NO_ENUM_IN_SELECTION_MESSAGE = 'No enum declaration found at the current selection.';
export const ENUM_CONVERSION_UNSUPPORTED_MESSAGE = 'Selected enum cannot be converted to a const object.';
export const ENUM_CONVERSION_APPLY_FAILURE_MESSAGE = 'Could not apply enum conversion changes.';
export const ENUM_CONVERSION_SUCCESS_MESSAGE = 'Enum converted to const object successfully.';
export const NO_JSX_ATTRIBUTE_IN_SELECTION_MESSAGE = 'Place the caret inside a JSX attribute to toggle braces.';
export const JSX_ATTRIBUTE_TOGGLE_UNSUPPORTED_MESSAGE = 'Only string literal JSX attribute values can toggle braces.';
export const JSX_ATTRIBUTE_TOGGLE_APPLY_FAILURE_MESSAGE = 'Could not apply JSX attribute toggle.';
export const JSX_ATTRIBUTE_TOGGLE_WRAP_SUCCESS_MESSAGE = 'Wrapped JSX attribute value with braces.';
export const JSX_ATTRIBUTE_TOGGLE_UNWRAP_SUCCESS_MESSAGE = 'Removed braces from JSX attribute value.';

// String/template toggle
export const NO_STRING_OR_TEMPLATE_IN_SELECTION_MESSAGE =
  'Place the caret inside a string or template literal to toggle.';
export const STRING_TEMPLATE_TOGGLE_UNSUPPORTED_MESSAGE =
  'Only simple strings and templates without expressions can toggle.';
export const STRING_TEMPLATE_TOGGLE_APPLY_FAILURE_MESSAGE = 'Could not apply string/template toggle.';
export const STRING_TO_TEMPLATE_SUCCESS_MESSAGE = 'Converted string literal to template literal.';
export const TEMPLATE_TO_STRING_SUCCESS_MESSAGE = 'Converted template literal to string literal.';

// Arrow body toggle
export const NO_ARROW_FUNCTION_IN_SELECTION_MESSAGE =
  'Place the caret inside an arrow function to toggle its body.';
export const ARROW_BODY_TOGGLE_UNSUPPORTED_MESSAGE =
  'Only expression-bodied arrows or single-return block arrows can toggle.';
export const ARROW_BODY_TOGGLE_APPLY_FAILURE_MESSAGE = 'Could not apply arrow body toggle.';
export const ARROW_TO_BLOCK_SUCCESS_MESSAGE = 'Converted shorthand arrow to block with return.';
export const ARROW_TO_EXPRESSION_SUCCESS_MESSAGE = 'Converted block-bodied arrow to shorthand expression.';

// Arrow parameter parentheses
export const NO_ARROW_FOR_PARAM_PARENS_MESSAGE =
  'Place the caret inside an arrow function to add parentheses to its parameter.';
export const ARROW_PARAM_PARENS_UNSUPPORTED_MESSAGE =
  'Only single identifier parameter arrows are supported.';
export const ARROW_PARAM_ALREADY_PARENTHESIZED_MESSAGE = 'Arrow parameter already has parentheses.';
export const ARROW_PARAM_PARENS_APPLY_FAILURE_MESSAGE = 'Could not apply arrow parameter parentheses edit.';
export const ARROW_PARAM_PARENS_SUCCESS_MESSAGE = 'Added parentheses to arrow parameter.';

// String split/merge
export const NO_STRING_FOR_SPLIT_OR_MERGE_MESSAGE =
  'Place the caret inside a string to split, or select a + chain of string literals to merge.';
export const STRING_SPLIT_MERGE_UNSUPPORTED_MESSAGE =
  'Only simple quoted strings can be split; merge supports + chains of same-quote string literals.';
export const STRING_SPLIT_MERGE_APPLY_FAILURE_MESSAGE = 'Could not apply string split/merge change.';
export const STRING_SPLIT_SUCCESS_MESSAGE = 'Split string literal at caret.';
export const STRING_MERGE_SUCCESS_MESSAGE = 'Merged adjacent string literals.';

// Variable kind conversion
export const NO_VARIABLE_DECLARATION_IN_SELECTION_MESSAGE = 'No variable declaration found at the current selection.';
export const VARIABLE_CONVERSION_UNSUPPORTED_MESSAGE =
  'Selected declaration cannot be converted (missing initializer or subsequent writes detected).';
export const VARIABLE_CONVERSION_APPLY_FAILURE_MESSAGE = 'Could not apply variable kind conversion.';
export const VARIABLE_CONVERSION_TO_LET_SUCCESS_MESSAGE = 'Converted declaration to let.';
export const VARIABLE_CONVERSION_TO_CONST_SUCCESS_MESSAGE = 'Converted declaration to const.';

// Variable split
export const VARIABLE_SPLIT_UNSUPPORTED_MESSAGE =
  'Selected declaration cannot be split (requires simple identifiers and compatible kind).';
export const VARIABLE_SPLIT_APPLY_FAILURE_MESSAGE = 'Could not apply variable split changes.';
export const VARIABLE_SPLIT_MULTIPLE_SUCCESS_MESSAGE = 'Split into multiple declarations.';
export const VARIABLE_SPLIT_DECL_INIT_SUCCESS_MESSAGE = 'Split declaration and initialization.';

// Variable merge
export const VARIABLE_MERGE_UNSUPPORTED_MESSAGE =
  'Selected statements cannot be merged (requires single identifier declaration followed by matching assignment).';
export const VARIABLE_MERGE_APPLY_FAILURE_MESSAGE = 'Could not apply variable merge changes.';
export const VARIABLE_MERGE_SUCCESS_MESSAGE = 'Merged declaration and initialization.';
