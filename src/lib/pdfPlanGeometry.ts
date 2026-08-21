import {
  OPS,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';

export type PdfMatrix = [number, number, number, number, number, number];

export type PdfPathGeometry = {
  sourceOperatorIndex: number;
  sourceTransform: PdfMatrix;
  sourceBounds: [number, number, number, number] | null;
  commands: number[];
  paintOperation: number;
  stroke: string;
  fill: string;
  strokeAlpha: number;
  fillAlpha: number;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  optionalContentId: string | null;
  optionalContentName: string | null;
};

export type PdfTextGeometry = {
  sourceItemIndex: number;
  text: string;
  sourceTransform: PdfMatrix;
  sourceWidth: number;
  sourceHeight: number;
  fontName: string;
};

export type PdfPageGeometry = {
  pageNumber: number;
  sourceView: [number, number, number, number];
  sourceWidth: number;
  sourceHeight: number;
  rotation: number;
  userUnit: number;
  paths: PdfPathGeometry[];
  texts: PdfTextGeometry[];
};

type GraphicsState = {
  transform: PdfMatrix;
  stroke: string;
  fill: string;
  strokeAlpha: number;
  fillAlpha: number;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
};

const IDENTITY: PdfMatrix = [1, 0, 0, 1, 0, 0];

function multiply(left: PdfMatrix, right: PdfMatrix): PdfMatrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function cloneState(state: GraphicsState): GraphicsState {
  return { ...state, transform: [...state.transform] as PdfMatrix };
}

function cssColor(args: unknown[] | null | undefined, fallback: string): string {
  const value = args?.[0];
  return typeof value === 'string' ? value : fallback;
}

function asNumbers(value: unknown): number[] {
  if (!value || typeof value !== 'object') return [];
  return Array.from(value as ArrayLike<number>);
}

function optionalContentName(
  config: { getGroup: (id: string) => { name?: string } | null },
  id: string | null,
): string | null {
  return id ? config.getGroup(id)?.name ?? null : null;
}

export async function extractPdfPageGeometry(
  document: PDFDocumentProxy,
  page: PDFPageProxy,
): Promise<PdfPageGeometry> {
  const [operators, textContent, optionalContent] = await Promise.all([
    page.getOperatorList(),
    page.getTextContent(),
    document.getOptionalContentConfig(),
  ]);
  const stateStack: GraphicsState[] = [];
  const optionalContentStack: Array<string | null> = [];
  let state: GraphicsState = {
    transform: IDENTITY,
    stroke: '#000000',
    fill: '#000000',
    strokeAlpha: 1,
    fillAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
  };
  const paths: PdfPathGeometry[] = [];

  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index];
    const args = operators.argsArray[index] as unknown[] | null;
    if (operation === OPS.save) {
      stateStack.push(cloneState(state));
    } else if (operation === OPS.restore) {
      state = stateStack.pop() ?? state;
    } else if (operation === OPS.transform && args) {
      state.transform = multiply(state.transform, args as PdfMatrix);
    } else if (operation === OPS.setStrokeRGBColor) {
      state.stroke = cssColor(args, state.stroke);
    } else if (operation === OPS.setFillRGBColor) {
      state.fill = cssColor(args, state.fill);
    } else if (operation === OPS.setLineWidth) {
      state.lineWidth = Number(args?.[0] ?? state.lineWidth);
    } else if (operation === OPS.setLineCap) {
      state.lineCap = (['butt', 'round', 'square'][Number(args?.[0])] ?? 'butt') as CanvasLineCap;
    } else if (operation === OPS.setLineJoin) {
      state.lineJoin = (['miter', 'round', 'bevel'][Number(args?.[0])] ?? 'miter') as CanvasLineJoin;
    } else if (operation === OPS.setMiterLimit) {
      state.miterLimit = Number(args?.[0] ?? state.miterLimit);
    } else if (operation === OPS.setGState) {
      const entries = Array.isArray(args?.[0]) ? args[0] as unknown[][] : [];
      for (const entry of entries) {
        if (entry[0] === 'CA') state.strokeAlpha = Number(entry[1]);
        if (entry[0] === 'ca') state.fillAlpha = Number(entry[1]);
      }
    } else if (operation === OPS.beginMarkedContentProps) {
      const properties = args?.[1] as { id?: unknown } | undefined;
      optionalContentStack.push(typeof properties?.id === 'string' ? properties.id : null);
    } else if (operation === OPS.endMarkedContent) {
      optionalContentStack.pop();
    } else if (operation === OPS.constructPath && args) {
      const paintOperation = Number(args[0]);
      const commandContainers = Array.isArray(args[1]) ? args[1] : [];
      const commands = asNumbers(commandContainers[0]);
      const bounds = asNumbers(args[2]);
      const optionalContentId = optionalContentStack.at(-1) ?? null;
      paths.push({
        sourceOperatorIndex: index,
        sourceTransform: [...state.transform] as PdfMatrix,
        sourceBounds: bounds.length === 4 ? bounds as [number, number, number, number] : null,
        commands,
        paintOperation,
        stroke: state.stroke,
        fill: state.fill,
        strokeAlpha: state.strokeAlpha,
        fillAlpha: state.fillAlpha,
        lineWidth: state.lineWidth,
        lineCap: state.lineCap,
        lineJoin: state.lineJoin,
        miterLimit: state.miterLimit,
        optionalContentId,
        optionalContentName: optionalContentName(optionalContent, optionalContentId),
      });
    }
  }

  const texts: PdfTextGeometry[] = textContent.items.flatMap((item, sourceItemIndex) => {
    if (!('str' in item) || item.str.length === 0) return [];
    return [{
      sourceItemIndex,
      text: item.str,
      sourceTransform: [...item.transform] as PdfMatrix,
      sourceWidth: item.width,
      sourceHeight: item.height,
      fontName: item.fontName,
    }];
  });
  const sourceView = [...page.view] as [number, number, number, number];

  return {
    pageNumber: page.pageNumber,
    sourceView,
    sourceWidth: sourceView[2] - sourceView[0],
    sourceHeight: sourceView[3] - sourceView[1],
    rotation: page.rotate,
    userUnit: page.userUnit,
    paths,
    texts,
  };
}

function buildPath(commands: number[]): Path2D {
  const path = new Path2D();
  for (let index = 0; index < commands.length;) {
    const operation = commands[index++];
    if (operation === 0) path.moveTo(commands[index++], commands[index++]);
    else if (operation === 1) path.lineTo(commands[index++], commands[index++]);
    else if (operation === 2) {
      path.bezierCurveTo(
        commands[index++], commands[index++],
        commands[index++], commands[index++],
        commands[index++], commands[index++],
      );
    } else if (operation === 3) path.closePath();
    else break;
  }
  return path;
}

function paintsFill(operation: number): boolean {
  return [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(operation);
}

function paintsStroke(operation: number): boolean {
  return [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(operation);
}

export function renderPdfPageGeometry(
  context: CanvasRenderingContext2D,
  geometry: PdfPageGeometry,
  viewportTransform: PdfMatrix,
  width: number,
  height: number,
): void {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  for (const primitive of geometry.paths) {
    if (primitive.paintOperation === OPS.endPath) continue;
    const transform = multiply(viewportTransform, primitive.sourceTransform);
    const path = buildPath(primitive.commands);
    context.save();
    context.setTransform(...transform);
    context.lineWidth = primitive.lineWidth > 0 ? primitive.lineWidth : 0.5;
    context.lineCap = primitive.lineCap;
    context.lineJoin = primitive.lineJoin;
    context.miterLimit = primitive.miterLimit;
    if (paintsFill(primitive.paintOperation)) {
      context.globalAlpha = primitive.fillAlpha;
      context.fillStyle = primitive.fill;
      context.fill(path, [OPS.eoFill, OPS.eoFillStroke, OPS.closeEOFillStroke].includes(primitive.paintOperation) ? 'evenodd' : 'nonzero');
    }
    if (paintsStroke(primitive.paintOperation)) {
      context.globalAlpha = primitive.strokeAlpha;
      context.strokeStyle = primitive.stroke;
      context.stroke(path);
    }
    context.restore();
  }

  for (const text of geometry.texts) {
    const transform = multiply(viewportTransform, text.sourceTransform);
    context.save();
    context.setTransform(...transform);
    context.scale(1, -1);
    context.fillStyle = '#000000';
    context.font = '1px sans-serif';
    context.fillText(text.text, 0, 0);
    context.restore();
  }
  context.restore();
}
