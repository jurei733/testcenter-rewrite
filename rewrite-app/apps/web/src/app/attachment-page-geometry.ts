// The printed Original page is A4 with a 40 mm QR at 20/20 mm.
// Its camera search adds the same 0.9/1.1 placement/size allowance.
export const attachmentPageGeometry = (width: number, height: number, mirrored = false) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const pageWidth = Math.min(width, height * 210 / 297);
  const pageHeight = pageWidth * 297 / 210;
  const scale = pageHeight / 297;
  const x = mirrored ? width - pageWidth : 0;
  return {
    page: { x, y: 0, width: pageWidth, height: pageHeight },
    scanRegion: {
      x: x + 20 * .9 * scale,
      y: 20 * .9 * scale,
      width: 40 * 1.1 * scale,
      height: 40 * 1.1 * scale
    },
    scanLeftPercent: (mirrored ? 210 - 18 - 44 : 18) / 210 * 100,
    videoWidthPercent: width / pageWidth * 100,
    videoHeightPercent: height / pageHeight * 100
  };
};

export const attachmentCameraMirrored = (stream: MediaStream | null): boolean => {
  const track = stream?.getVideoTracks()[0];
  return track?.getSettings().facingMode === "user" || /front|user|face/i.test(track?.label ?? "");
};
