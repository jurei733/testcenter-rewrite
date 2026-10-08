import QrScanner from "qr-scanner";
import { AttachmentQrDecoder } from "./attachment-qr-decoder";

type CameraDependencies = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createDecoder: () => AttachmentQrDecoder;
  schedule: (callback: () => void, milliseconds: number) => number;
  cancel: (handle: number) => void;
  visibility?: {
    hidden: () => boolean;
    subscribe: (listener: () => void) => () => void;
  };
};

const defaultDependencies: CameraDependencies = {
  getUserMedia: constraints => {
    if (!navigator.mediaDevices) return Promise.reject(new Error("Camera not found."));
    return navigator.mediaDevices.getUserMedia(constraints);
  },
  createDecoder: () => new AttachmentQrDecoder(),
  schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
  cancel: handle => window.clearTimeout(handle),
  visibility: {
    hidden: () => document.hidden,
    subscribe: listener => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    }
  }
};

// Camera ownership is explicit. QR decoding uses the same worker as saved
// images, without replacing SDK globals or writing its private engine fields.
export class AttachmentCameraScanner {
  private stream: MediaStream | null = null;
  private decoder: AttachmentQrDecoder | null = null;
  private timer: number | null = null;
  private generation = 0;
  private destroyed = false;
  private active = false;
  private flash = false;
  private preferredCamera: string;
  private requested = false;
  private visibilityVersion = 0;
  private readonly unsubscribeVisibility: (() => void) | undefined;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onDecode: (result: QrScanner.ScanResult) => void | Promise<void>,
    private readonly onError: (error: unknown) => void,
    preferredCamera = "environment",
    private readonly dependencies = defaultDependencies,
    private readonly onActivityChange: (active: boolean) => void = () => undefined
  ) {
    this.preferredCamera = preferredCamera;
    this.unsubscribeVisibility = dependencies.visibility?.subscribe(() => {
      if (this.destroyed) return;
      if (dependencies.visibility?.hidden()) {
        this.visibilityVersion++;
        const requested = this.requested;
        this.stop();
        this.requested = requested;
      } else if (this.requested && !this.active) {
        void this.start().catch(error => {
          if (!this.destroyed && !(error instanceof DOMException && error.name === "AbortError")) this.onError(error);
        });
      }
    });
  }

  async start(): Promise<void> {
    if (this.destroyed) throw new DOMException("Camera scanner was destroyed.", "AbortError");
    this.stop();
    this.requested = true;
    if (this.dependencies.visibility?.hidden()) return;
    const generation = this.generation;
    const visibilityVersion = this.visibilityVersion;
    const cancelledByVisibility = () => !this.destroyed && this.requested &&
      visibilityVersion !== this.visibilityVersion;
    const preference = /^(environment|user)$/.test(this.preferredCamera)
      ? { facingMode: { ideal: this.preferredCamera } }
      : { deviceId: { exact: this.preferredCamera } };
    const stream = await this.dependencies.getUserMedia({
      audio: false,
      video: { ...preference, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    if (generation !== this.generation || this.destroyed) {
      stream.getTracks().forEach(track => track.stop());
      if (cancelledByVisibility()) return;
      throw new DOMException("Camera start was cancelled.", "AbortError");
    }
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    const track = stream.getVideoTracks()[0];
    const mirrored = track?.getSettings().facingMode === "user" || /front|user|face/i.test(track?.label ?? "");
    this.video.style.transform = mirrored ? "scaleX(-1)" : "";
    try {
      await this.video.play();
      if (generation !== this.generation || this.destroyed) {
        if (cancelledByVisibility()) return;
        throw new DOMException("Camera start was cancelled.", "AbortError");
      }
      this.decoder = this.dependencies.createDecoder();
      this.active = true;
      this.onActivityChange(true);
      this.schedule(generation, 0);
    } catch (error) {
      if (generation !== this.generation && cancelledByVisibility()) return;
      // A cancelled old start must never stop a replacement camera's stream.
      if (generation === this.generation) this.stop();
      throw error;
    }
  }

  stop(): void {
    this.generation++;
    this.requested = false;
    const wasActive = this.active;
    this.active = false;
    this.flash = false;
    if (this.timer !== null) this.dependencies.cancel(this.timer);
    this.timer = null;
    this.decoder?.dispose();
    this.decoder = null;
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach(track => track.stop());
    if (stream && this.video.srcObject === stream) {
      this.video.pause();
      this.video.srcObject = null;
    }
    if (wasActive) this.onActivityChange(false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeVisibility?.();
    this.stop();
  }

  isActive(): boolean { return this.active; }

  async setCamera(cameraId: string): Promise<void> {
    this.preferredCamera = cameraId;
    await this.start();
  }

  async hasFlash(): Promise<boolean> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || !this.active || typeof track.getCapabilities !== "function") return false;
    return Boolean((track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }).torch);
  }

  isFlashOn(): boolean { return this.flash; }

  async toggleFlash(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    const generation = this.generation;
    if (!track || !await this.hasFlash()) throw new Error("This camera has no flash.");
    if (generation !== this.generation) throw new DOMException("Camera was stopped.", "AbortError");
    const next = !this.flash;
    await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }] });
    if (generation === this.generation) this.flash = next;
  }

  private schedule(generation: number, delay: number): void {
    if (!this.active || generation !== this.generation) return;
    this.timer = this.dependencies.schedule(() => { void this.scan(generation); }, delay);
  }

  private async scan(generation: number): Promise<void> {
    if (!this.active || generation !== this.generation) return;
    this.timer = null;
    const decoder = this.decoder;
    try {
      if (decoder && this.video.readyState >= 2 && this.video.videoWidth && this.video.videoHeight) {
        const result = await decoder.decode(this.video);
        if (!this.active || generation !== this.generation) return;
        await this.onDecode(result);
      }
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      if (error !== QrScanner.NO_QR_CODE_FOUND) {
        this.stop();
        this.onError(error);
        return;
      }
    }
    // One in-flight frame; no accumulated work or polling during async capture.
    this.schedule(generation, 125);
  }
}
