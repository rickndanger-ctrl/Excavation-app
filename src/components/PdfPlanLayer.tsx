import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfPageGeometry, renderPdfPageGeometry, type PdfMatrix } from '../lib/pdfPlanGeometry';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_ZOOM_BUCKETS = [1, 1.5, 2, 3, 4, 6, 8] as const;
const RENDER_DEBOUNCE_MS = 160;
const OVERSAMPLE = 2;
// Bounds one RGBA frame to ~96 MiB for a 3:2 civil sheet. Rendering is
// double-buffered, so worst-case transient pressure stays near ~192 MiB.
const MAX_RENDER_DIMENSION = 6144;

type Props = {
  url: string;
  pageNumber: number;
  width: number;
  zoom: number;
  showSourcePdf: boolean;
  onDocumentLoaded: (pageCount: number) => void;
  onError: (message: string | null) => void;
};

function resolutionBucket(zoom: number): number {
  return RENDER_ZOOM_BUCKETS.find((candidate) => candidate >= zoom) ?? RENDER_ZOOM_BUCKETS.at(-1)!;
}

export function PdfPlanLayer({
  url,
  pageNumber,
  width,
  zoom,
  showSourcePdf,
  onDocumentLoaded,
  onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const extractedCanvasRef = useRef<HTMLCanvasElement>(null);
  const retainedPageRef = useRef<PDFPageProxy | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const requestedBucket = useMemo(() => resolutionBucket(zoom), [zoom]);
  const [renderBucket, setRenderBucket] = useState(requestedBucket);
  const [displayBucket, setDisplayBucket] = useState(requestedBucket);
  const [displayAspect, setDisplayAspect] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => setRenderBucket(requestedBucket), RENDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [requestedBucket]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument(url);

    void loadingTask.promise.then((loadedDocument) => {
      if (cancelled) {
        void loadedDocument.destroy();
        return;
      }
      setDocument(loadedDocument);
      onDocumentLoaded(loadedDocument.numPages);
      onError(null);
    }).catch((error: unknown) => {
      if (!cancelled) {
        onError(error instanceof Error ? error.message : 'The PDF could not be loaded.');
      }
    });

    return () => {
      cancelled = true;
      retainedPageRef.current?.cleanup();
      retainedPageRef.current = null;
      void loadingTask.destroy();
    };
  }, [onDocumentLoaded, onError, url]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const render = async () => {
      try {
        const safePage = Math.min(Math.max(pageNumber, 1), document.numPages);
        const page = await document.getPage(safePage);
        if (cancelled || !canvasRef.current || !extractedCanvasRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const deviceScale = Math.max(1, window.devicePixelRatio || 1) * OVERSAMPLE;
        const requestedWidth = width * renderBucket * deviceScale;
        const scaleForWidth = requestedWidth / baseViewport.width;
        const scaleForCap = MAX_RENDER_DIMENSION / Math.max(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale: Math.min(scaleForWidth, scaleForCap) });
        const geometryPromise = extractPdfPageGeometry(document, page);

        // Keep the previous complete frame visible until the replacement is ready.
        const frame = window.document.createElement('canvas');
        frame.width = Math.ceil(viewport.width);
        frame.height = Math.ceil(viewport.height);
        const frameContext = frame.getContext('2d', { alpha: false });
        if (!frameContext) throw new Error('This browser could not create the plan canvas.');

        renderTask = page.render({ canvas: frame, canvasContext: frameContext, viewport });
        const [, geometry] = await Promise.all([renderTask.promise, geometryPromise]);
        if (cancelled || !canvasRef.current || !extractedCanvasRef.current) return;

        const visible = canvasRef.current;
        visible.width = frame.width;
        visible.height = frame.height;
        const visibleContext = visible.getContext('2d', { alpha: false });
        if (!visibleContext) throw new Error('This browser could not display the plan canvas.');
        visibleContext.drawImage(frame, 0, 0);
        visible.dataset.renderZoom = String(renderBucket);
        visible.dataset.renderedPage = String(safePage);
        visible.dataset.sourcePageWidth = String(baseViewport.width);
        visible.dataset.sourcePageHeight = String(baseViewport.height);

        const extracted = extractedCanvasRef.current;
        extracted.width = frame.width;
        extracted.height = frame.height;
        const extractedContext = extracted.getContext('2d', { alpha: false });
        if (!extractedContext) throw new Error('This browser could not display extracted plan geometry.');
        renderPdfPageGeometry(
          extractedContext,
          geometry,
          viewport.transform as PdfMatrix,
          extracted.width,
          extracted.height,
        );
        extracted.dataset.pathCount = String(geometry.paths.length);
        extracted.dataset.textCount = String(geometry.texts.length);
        extracted.dataset.sourcePageWidth = String(geometry.sourceWidth);
        extracted.dataset.sourcePageHeight = String(geometry.sourceHeight);
        extracted.dataset.sourcePageRotation = String(geometry.rotation);
        extracted.dataset.renderedPage = String(safePage);
        if (retainedPageRef.current?.pageNumber !== page.pageNumber) {
          retainedPageRef.current?.cleanup();
          retainedPageRef.current = page;
        }
        setDisplayBucket(renderBucket);
        setDisplayAspect(viewport.height / viewport.width);
        onError(null);
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === 'RenderingCancelledException')) return;
        onError(error instanceof Error ? error.message : 'The PDF sheet could not be rendered.');
      }
    };

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, onError, pageNumber, renderBucket, width]);

  const canvasStyle = {
    width: width * displayBucket,
    height: 'auto',
    transform: `scale(${1 / displayBucket})`,
    transformOrigin: '0 0',
  } as const;

  return (
    <div className="plan-canvas__pdf-stack" style={{ width, height: width * displayAspect }}>
      <canvas
        ref={canvasRef}
        className="plan-canvas__image plan-canvas__pdf"
        style={{ ...canvasStyle, visibility: showSourcePdf ? 'visible' : 'hidden' }}
        aria-label={`Imported civil plan, page ${pageNumber}`}
      />
      <canvas
        ref={extractedCanvasRef}
        className="plan-canvas__image plan-canvas__extracted"
        style={{ ...canvasStyle, visibility: showSourcePdf ? 'hidden' : 'visible' }}
        aria-label={`Extracted source geometry, page ${pageNumber}`}
      />
    </div>
  );
}
