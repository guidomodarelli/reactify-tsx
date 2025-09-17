import * as vscode from 'vscode';
import * as ts from 'typescript';

interface ArrowContext {
	arrow: ts.ArrowFunction;
	attribute: ts.JsxAttribute;
}

interface FunctionComponentContext {
	kind: 'function';
	functionNode: ts.FunctionLikeDeclaration;
	block: ts.Block | undefined;
}

interface ClassComponentContext {
	kind: 'class';
	classNode: ts.ClassLikeDeclaration;
	containingMember: ts.ClassElement;
}

type ComponentContext = FunctionComponentContext | ClassComponentContext;

export async function extractArrowFunctionCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage('No hay un editor activo.');
		return;
	}

	const { document, selection } = editor;
	const sourceText = document.getText();
	const sourceFile = ts.createSourceFile(
		document.fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		determineScriptKind(document)
	);

	const selectionStart = document.offsetAt(selection.start);
	const selectionEnd = document.offsetAt(selection.end);
	const arrowContext = findArrowFunction(sourceFile, selectionStart, selectionEnd);

	if (!arrowContext) {
		vscode.window.showErrorMessage('Selecciona una arrow function dentro de una propiedad JSX para extraerla.');
		return;
	}

	const componentContext = resolveComponentContext(arrowContext.attribute);
	if (!componentContext) {
		vscode.window.showErrorMessage('No se encontró un componente React contenedor.');
		return;
	}

	if (componentContext.kind === 'function' && !componentContext.block) {
		vscode.window.showErrorMessage('Actualmente solo se soportan componentes funcionales con cuerpo en bloque.');
		return;
	}

	const handlerName = createHandlerName(document, sourceFile, arrowContext.attribute, componentContext);
	const parameterText = buildParametersText(document, sourceFile, arrowContext.arrow, arrowContext.attribute, componentContext);
	const bodyDetails = buildBodyText(document, sourceFile, arrowContext.arrow);

	const replacementText = componentContext.kind === 'class' ? `this.${handlerName}` : handlerName;
	const arrowRange = getRangeFromNode(document, sourceFile, arrowContext.arrow);

	const { insertPosition, insertText, handlerDefinitionOffset } = buildInsertion(
		document,
		sourceFile,
		arrowContext.arrow,
		componentContext,
		handlerName,
		parameterText,
		bodyDetails
	);
	if (!insertPosition) {
		vscode.window.showErrorMessage('No se pudo determinar dónde insertar la nueva función.');
		return;
	}

	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, arrowRange, replacementText);
	edit.insert(document.uri, insertPosition, insertText);

	const success = await vscode.workspace.applyEdit(edit);
	if (!success) {
		vscode.window.showErrorMessage('No se pudieron aplicar los cambios de refactor.');
		return;
	}

	if (typeof handlerDefinitionOffset === 'number') {
		const renameStart = document.positionAt(handlerDefinitionOffset);
		const renameEnd = renameStart.translate(0, handlerName.length);
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
			activeEditor.selection = new vscode.Selection(renameStart, renameEnd);
			activeEditor.revealRange(new vscode.Range(renameStart, renameEnd), vscode.TextEditorRevealType.Default);
			try {
				await vscode.commands.executeCommand('editor.action.rename');
			} catch (error) {
				console.error('No se pudo iniciar la acción de renombrar:', error);
			}
		}
	}

	vscode.window.showInformationMessage(`Función '${handlerName}' extraída correctamente.`);
}

function determineScriptKind(document: vscode.TextDocument): ts.ScriptKind {
	const filename = document.fileName.toLowerCase();
	if (filename.endsWith('.tsx')) {
		return ts.ScriptKind.TSX;
	}
	if (filename.endsWith('.ts')) {
		return ts.ScriptKind.TS;
	}
	if (filename.endsWith('.jsx')) {
		return ts.ScriptKind.JSX;
	}
	if (filename.endsWith('.js')) {
		return ts.ScriptKind.JS;
	}
	switch (document.languageId) {
		case 'typescriptreact':
			return ts.ScriptKind.TSX;
		case 'javascriptreact':
			return ts.ScriptKind.JSX;
		case 'typescript':
			return ts.ScriptKind.TS;
		case 'javascript':
			return ts.ScriptKind.JS;
		default:
			return ts.ScriptKind.TSX;
	}
}

function findArrowFunction(sourceFile: ts.SourceFile, startOffset: number, endOffset: number): ArrowContext | undefined {
	let result: ArrowContext | undefined;
	const rangeStart = Math.min(startOffset, endOffset);
	const rangeEnd = Math.max(startOffset, endOffset);

	function visit(node: ts.Node) {
		if (rangeStart < node.getStart(sourceFile) || rangeEnd > node.getEnd()) {
			return;
		}

		if (ts.isArrowFunction(node)) {
			const attribute = findParentJsxAttribute(node);
			if (attribute) {
				result = { arrow: node, attribute };
				return;
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return result;
}

function findParentJsxAttribute(node: ts.Node): ts.JsxAttribute | undefined {
	let current: ts.Node | undefined = node;
	while (current) {
		if (ts.isJsxAttribute(current)) {
			return current;
		}
		current = current.parent;
	}
	return undefined;
}

function resolveComponentContext(attribute: ts.JsxAttribute): ComponentContext | undefined {
	let current: ts.Node | undefined = attribute;
	while (current) {
		if (ts.isClassLike(current)) {
			const member = findContainingMember(current, attribute);
			if (!member) {
				return undefined;
			}
			return { kind: 'class', classNode: current, containingMember: member };
		}
		if (isComponentFunctionLike(current)) {
			const block = current.body && ts.isBlock(current.body) ? current.body : undefined;
			return { kind: 'function', functionNode: current, block };
		}
		current = current.parent;
	}
	return undefined;
}

function isComponentFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node)
	);
}

function findContainingMember(classNode: ts.ClassLikeDeclaration, inner: ts.Node): ts.ClassElement | undefined {
	return classNode.members.find((member) => inner.pos >= member.pos && inner.end <= member.end);
}

function createHandlerName(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	attribute: ts.JsxAttribute,
	componentContext: ComponentContext
): string {
	const attributeName = attribute.name.getText(sourceFile);
	const base = buildHandlerBaseName(attributeName);
	const componentText = document.getText(getComponentRange(document, sourceFile, componentContext));
	let candidate = base;
	let counter = 2;
	const duplicateRegex = () => new RegExp(`\\b${candidate}\\b`);
	while (duplicateRegex().test(componentText)) {
		candidate = `${base}${counter}`;
		counter += 1;
	}
	return candidate;
}

function buildHandlerBaseName(attributeName: string): string {
	if (/^on[A-Z]/.test(attributeName)) {
		return `handle${attributeName.slice(2)}`;
	}
	const capitalized = attributeName.replace(/^[a-z]/, (char) => char.toUpperCase());
	return capitalized ? `handle${capitalized}` : 'handleEvent';
}

function getComponentRange(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	componentContext: ComponentContext
): vscode.Range {
	if (componentContext.kind === 'function') {
		return getRangeFromNode(document, sourceFile, componentContext.functionNode);
	}
	return getRangeFromNode(document, sourceFile, componentContext.classNode);
}

function buildParametersText(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	arrow: ts.ArrowFunction,
	attribute: ts.JsxAttribute,
	componentContext: ComponentContext
): string {
	if (arrow.parameters.length === 0) {
		return '';
	}

	return arrow.parameters
		.map((parameter, index) =>
			buildParameterString(document, sourceFile, parameter, index, attribute, arrow, componentContext)
		)
		.join(', ');
}

function buildParameterString(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	parameter: ts.ParameterDeclaration,
	index: number,
	attribute: ts.JsxAttribute,
	arrow: ts.ArrowFunction,
	componentContext: ComponentContext
): string {
	const originalText = document.getText(getRangeFromNode(document, sourceFile, parameter));
	if (parameter.type) {
		return originalText;
	}

	if (!ts.isIdentifier(parameter.name)) {
		return `/* FIXME: agregar tipo manualmente */ ${originalText}`;
	}

	const inferred = index === 0 ? inferEventType(attribute, sourceFile) : undefined;
	const name = parameter.name.getText(sourceFile);
	const optional = parameter.questionToken ? '?' : '';
	const rest = parameter.dotDotDotToken ? '...' : '';
	const initializer = parameter.initializer
		? ` = ${document.getText(getRangeFromNode(document, sourceFile, parameter.initializer))}`
		: '';

	if (inferred) {
		return `${rest}${name}${optional}: ${inferred}${initializer}`;
	}

	return `/* FIXME: agregar tipo manualmente */ ${originalText}`;
}

interface EventTypeMapping {
	reactType: string;
	defaultElement?: string;
}

const attributeEventTypeMap: Record<string, EventTypeMapping> = {
	onClick: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onDoubleClick: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onMouseDown: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onMouseUp: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onMouseEnter: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onMouseLeave: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onMouseMove: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onContextMenu: { reactType: 'React.MouseEvent', defaultElement: 'HTMLElement' },
	onChange: { reactType: 'React.ChangeEvent', defaultElement: 'HTMLElement' },
	onInput: { reactType: 'React.FormEvent', defaultElement: 'HTMLElement' },
	onSubmit: { reactType: 'React.FormEvent', defaultElement: 'HTMLFormElement' },
	onReset: { reactType: 'React.FormEvent', defaultElement: 'HTMLFormElement' },
	onFocus: { reactType: 'React.FocusEvent', defaultElement: 'HTMLElement' },
	onBlur: { reactType: 'React.FocusEvent', defaultElement: 'HTMLElement' },
	onKeyDown: { reactType: 'React.KeyboardEvent', defaultElement: 'HTMLElement' },
	onKeyUp: { reactType: 'React.KeyboardEvent', defaultElement: 'HTMLElement' },
	onKeyPress: { reactType: 'React.KeyboardEvent', defaultElement: 'HTMLElement' },
	onTouchStart: { reactType: 'React.TouchEvent', defaultElement: 'HTMLElement' },
	onTouchEnd: { reactType: 'React.TouchEvent', defaultElement: 'HTMLElement' },
	onTouchMove: { reactType: 'React.TouchEvent', defaultElement: 'HTMLElement' },
	onPointerDown: { reactType: 'React.PointerEvent', defaultElement: 'HTMLElement' },
	onPointerUp: { reactType: 'React.PointerEvent', defaultElement: 'HTMLElement' },
	onPointerMove: { reactType: 'React.PointerEvent', defaultElement: 'HTMLElement' },
	onPointerEnter: { reactType: 'React.PointerEvent', defaultElement: 'HTMLElement' },
	onPointerLeave: { reactType: 'React.PointerEvent', defaultElement: 'HTMLElement' },
	onWheel: { reactType: 'React.WheelEvent', defaultElement: 'HTMLElement' },
	onDrag: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDragStart: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDragEnd: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDragEnter: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDragOver: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDragLeave: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onDrop: { reactType: 'React.DragEvent', defaultElement: 'HTMLElement' },
	onScroll: { reactType: 'React.UIEvent', defaultElement: 'HTMLElement' }
};

const htmlElementTypeMap: Record<string, string> = {
	a: 'HTMLAnchorElement',
	area: 'HTMLAreaElement',
	article: 'HTMLElement',
	audio: 'HTMLAudioElement',
	button: 'HTMLButtonElement',
	canvas: 'HTMLCanvasElement',
	div: 'HTMLDivElement',
	form: 'HTMLFormElement',
	iframe: 'HTMLIFrameElement',
	img: 'HTMLImageElement',
	input: 'HTMLInputElement',
	label: 'HTMLLabelElement',
	li: 'HTMLLIElement',
	nav: 'HTMLElement',
	ol: 'HTMLOListElement',
	option: 'HTMLOptionElement',
	p: 'HTMLParagraphElement',
	section: 'HTMLElement',
	select: 'HTMLSelectElement',
	span: 'HTMLSpanElement',
	table: 'HTMLTableElement',
	textarea: 'HTMLTextAreaElement',
	td: 'HTMLTableCellElement',
	th: 'HTMLTableCellElement',
	tr: 'HTMLTableRowElement',
	ul: 'HTMLUListElement',
	video: 'HTMLVideoElement'
};

function inferEventType(
	attribute: ts.JsxAttribute,
	sourceFile: ts.SourceFile
): string | undefined {
	const attributeName = attribute.name.getText(sourceFile);
	const mapping = attributeEventTypeMap[attributeName];
	if (!mapping) {
		return undefined;
	}
	const elementType = findHtmlElementType(attribute, sourceFile) ?? mapping.defaultElement ?? 'Element';
	return `${mapping.reactType}<${elementType}>`;
}

function findHtmlElementType(attribute: ts.JsxAttribute, sourceFile: ts.SourceFile): string | undefined {
	const attributesParent = attribute.parent;
	if (!attributesParent) {
		return undefined;
	}
	const jsxParent = attributesParent.parent;
	if (ts.isJsxOpeningElement(jsxParent) || ts.isJsxSelfClosingElement(jsxParent)) {
		const tag = jsxParent.tagName.getText(sourceFile);
		if (/^[a-z]/.test(tag)) {
			const lower = tag.toLowerCase();
			return htmlElementTypeMap[lower] ?? 'HTMLElement';
		}
	}
	return undefined;
}

interface BodyBuildResult {
	kind: 'block' | 'expression';
	text: string;
}

function buildBodyText(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	arrow: ts.ArrowFunction
): BodyBuildResult {
	if (ts.isBlock(arrow.body)) {
		const inner = extractBlockInnerText(document, sourceFile, arrow.body);
		return { kind: 'block', text: inner };
	}
	const expression = document.getText(getRangeFromNode(document, sourceFile, arrow.body));
	return { kind: 'expression', text: expression };
}

function extractBlockInnerText(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	block: ts.Block
): string {
	const start = block.getStart(sourceFile) + 1;
	const end = block.getEnd() - 1;
	if (end <= start) {
		return '';
	}
	return document.getText(new vscode.Range(document.positionAt(start), document.positionAt(end)));
}

function buildInsertion(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	arrow: ts.ArrowFunction,
	componentContext: ComponentContext,
	handlerName: string,
	parameterText: string,
	body: BodyBuildResult
): { insertPosition?: vscode.Position; insertText: string; handlerDefinitionOffset?: number } {
	const paramsWrapped = parameterText ? `(${parameterText})` : '()';
	if (componentContext.kind === 'function') {
		const { block } = componentContext;
		if (!block) {
			return { insertText: '' };
		}
		const targetStatement = findContainingStatement(block, arrow);
		const insertOffset = targetStatement ? targetStatement.getStart(sourceFile) : block.getEnd() - 1;
		const insertPosition = document.positionAt(insertOffset);
		const indent = getLineIndent(document, insertPosition.line);
		const indentUnit = getIndentUnit();
		const handlerText = buildConstHandlerText(indent, indentUnit, handlerName, paramsWrapped, body);
		const handlerNameOffset = insertOffset + indent.length + 'const '.length;
		return { insertPosition, insertText: handlerText, handlerDefinitionOffset: handlerNameOffset };
	}
	const insertOffset = componentContext.containingMember.getStart(sourceFile);
	const insertPosition = document.positionAt(insertOffset);
	const indent = getLineIndent(document, insertPosition.line);
	const indentUnit = getIndentUnit();
	const methodText = buildMethodText(indent, indentUnit, handlerName, paramsWrapped, body);
	const handlerNameOffset = insertOffset + indent.length;
	return { insertPosition, insertText: methodText, handlerDefinitionOffset: handlerNameOffset };
}

function buildConstHandlerText(
	indent: string,
	indentUnit: string,
	handlerName: string,
	paramsWrapped: string,
	body: BodyBuildResult
): string {
	if (body.kind === 'block') {
		const normalized = normalizeBlockBody(body.text, indent + indentUnit);
		return `${indent}const ${handlerName} = ${paramsWrapped} => {\n${normalized}${normalized ? '\n' : ''}${indent}};\n\n`;
	}
	return `${indent}const ${handlerName} = ${paramsWrapped} => ${body.text};\n\n`;
}

function buildMethodText(
	indent: string,
	indentUnit: string,
	handlerName: string,
	paramsWrapped: string,
	body: BodyBuildResult
): string {
	if (body.kind === 'block') {
		const normalized = normalizeBlockBody(body.text, indent + indentUnit);
		return `${indent}${handlerName}${paramsWrapped} {\n${normalized}${normalized ? '\n' : ''}${indent}}\n\n`;
	}
	const returnLine = `${indent + indentUnit}return ${body.text};`;
	return `${indent}${handlerName}${paramsWrapped} {\n${returnLine}\n${indent}}\n\n`;
}

function normalizeBlockBody(body: string, baseIndent: string): string {
	const lines = body.split(/\r?\n/);
	const trimmed = trimEmptyEdges(lines);
	const dedented = dedent(trimmed);
	return dedented
		.map((line) => line.length === 0 ? '' : `${baseIndent}${line}`)
		.join('\n');
}

function trimEmptyEdges(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim().length === 0) {
		start += 1;
	}
	while (end > start && lines[end - 1].trim().length === 0) {
		end -= 1;
	}
	return lines.slice(start, end);
}

function dedent(lines: string[]): string[] {
	const nonEmpty = lines.filter((line) => line.trim().length > 0);
	if (nonEmpty.length === 0) {
		return lines;
	}
	const minIndent = Math.min(
		...nonEmpty.map((line) => (line.match(/^\s*/)?.[0].length ?? 0))
	);
	return lines.map((line) => line.slice(minIndent));
}

function findContainingStatement(block: ts.Block, arrow: ts.ArrowFunction): ts.Statement | undefined {
	return block.statements.find((statement) => arrow.pos >= statement.pos && arrow.end <= statement.end);
}

function getLineIndent(document: vscode.TextDocument, line: number): string {
	if (line < 0 || line >= document.lineCount) {
		return '';
	}
	return document.lineAt(line).text.match(/^\s*/)?.[0] ?? '';
}

function getIndentUnit(): string {
	const editor = vscode.window.activeTextEditor;
	const tabSize = typeof editor?.options.tabSize === 'number' ? editor.options.tabSize : 2;
	const insertSpaces = editor?.options.insertSpaces !== false;
	return insertSpaces ? ' '.repeat(Math.max(1, tabSize)) : '\t';
}

function getRangeFromNode(
	document: vscode.TextDocument,
	sourceFile: ts.SourceFile,
	node: ts.Node
): vscode.Range {
	return new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()));
}
