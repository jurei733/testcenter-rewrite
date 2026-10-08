// Published export of the pinned qr-scanner 1.4.1 worker module. The SDK's
// documented scanImage qrEngine option accepts the returned native Worker.
declare module "qr-scanner/qr-scanner-worker.min.js" {
  export function createWorker(): Worker;
}
