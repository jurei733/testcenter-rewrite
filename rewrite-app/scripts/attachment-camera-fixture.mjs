import QRCode from "qrcode";

// Real monochrome video data for Chromium's camera fixture. No DOM event,
// decoder result, authenticated lookup or captured image is synthesized.
export const createAttachmentQrCameraVideo = (code, { position = "printed" } = {}) => {
  const width = 1280, height = 720;
  const { modules } = QRCode.create(code, { errorCorrectionLevel: "M" });
  const margin = 4, square = Math.round(40 * height / 297);
  const offset = Math.round(20 * height / 297);
  const printed = position === "printed" || position === "printed-front";
  const left = position === "printed-front" ? Math.round(width - height * 210 / 297) + offset : printed ? offset : Math.round((width - square) / 2);
  const top = printed ? offset : Math.round((height - square) / 2);
  const luminance = Buffer.alloc(width * height, 235);
  for (let y = 0; y < square; y++) {
    for (let x = 0; x < square; x++) {
      const row = Math.floor(y / square * (modules.size + margin * 2)) - margin;
      const column = Math.floor(x / square * (modules.size + margin * 2)) - margin;
      if (row >= 0 && row < modules.size && column >= 0 && column < modules.size && modules.data[row * modules.size + column])
        luminance[(top + y) * width + left + x] = 16;
    }
  }
  return Buffer.concat([
    Buffer.from(`YUV4MPEG2 W${width} H${height} F5:1 Ip A1:1 C420jpeg\nFRAME\n`, "ascii"),
    luminance, Buffer.alloc(width * height / 2, 128)
  ]);
};
