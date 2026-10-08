import QrScanner from "qr-scanner";

export type AttachmentQrImage = File | Blob | HTMLVideoElement | HTMLCanvasElement;

type DecoderDependencies = {
  createWorker: () => Promise<Worker>;
  scanImage: typeof QrScanner.scanImage;
};

export const createAttachmentQrWorker = async (
  load = () => import("qr-scanner/qr-scanner-worker.min.js")
): Promise<Worker> => {
  const worker = (await load()).createWorker();
  try {
    // The pinned worker transport used by the SDK's setInversionMode. External
    // engines must retain scanImage's normal-and-inverted image behavior.
    worker.postMessage({ type: "inversionMode", data: "both" });
    return worker;
  } catch (error) {
    worker.terminate();
    throw error;
  }
};

const defaultDependencies: DecoderDependencies = {
  createWorker: createAttachmentQrWorker,
  scanImage: QrScanner.scanImage.bind(QrScanner)
};

// Native BarcodeDetector can advertise qr_code while its first decode hangs.
// Use the unchanged shipped engine through the public SDK option instead.
export class AttachmentQrDecoder {
  private engine: Promise<Worker> | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(private readonly dependencies = defaultDependencies) {}

  decode(image: AttachmentQrImage): Promise<QrScanner.ScanResult> {
    const operation = this.pending.then(async () => {
      this.assertOpen();
      const engine = await (this.engine ??= this.dependencies.createWorker());
      this.assertOpen();
      const result = await this.dependencies.scanImage(image, {
        qrEngine: engine,
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true
      });
      this.assertOpen();
      return result;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    void this.engine?.then(worker => worker.terminate(), () => undefined);
  }

  private assertOpen(): void {
    if (this.closed) throw new DOMException("QR decoder was closed.", "AbortError");
  }
}
