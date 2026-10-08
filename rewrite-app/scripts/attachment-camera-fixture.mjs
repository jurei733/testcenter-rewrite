import QRCode from "qrcode";

// Real monochrome video data for Chromium's camera fixture. No DOM event,
// decoder result, authenticated lookup or captured image is synthesized.
export const createAttachmentQrCameraVideo = code => {
  const width = 640, height = 480;
  const { modules } = QRCode.create(code, { errorCorrectionLevel: "M" });
  const margin = 4, scale = 3;
  const square = (modules.size + margin * 2) * scale;
  if (square > height) throw new Error("Owned QR camera fixture is too large.");
  const left = Math.floor((width - square) / 2), top = Math.floor((height - square) / 2);
  const luminance = Buffer.alloc(width * height, 235);
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (!modules.data[row * modules.size + column]) continue;
      for (let y = 0; y < scale; y++) {
        const start = (top + (row + margin) * scale + y) * width + left + (column + margin) * scale;
        luminance.fill(16, start, start + scale);
      }
    }
  }
  return Buffer.concat([
    Buffer.from(`YUV4MPEG2 W${width} H${height} F5:1 Ip A1:1 C420jpeg\nFRAME\n`, "ascii"),
    luminance, Buffer.alloc(width * height / 2, 128)
  ]);
};
