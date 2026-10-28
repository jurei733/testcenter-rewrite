/** Self-contained so the same checked function runs in Node and Chromium. */
export async function compareExactRgba({source, candidate}) {
  const decode = async input => {
    if (typeof input !== 'string') return input;
    const image = new Image(); image.src = 'data:image/png;base64,' + input; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return {width: canvas.width, height: canvas.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data};
  };
  source = await decode(source); candidate = await decode(candidate);
  for (const image of [source, candidate]) {
    if (!Number.isSafeInteger(image.width) || image.width <= 0 || !Number.isSafeInteger(image.height) || image.height <= 0 ||
      image.data.length !== image.width * image.height * 4) throw Error('A complete, nonempty RGBA viewport is required.');
  }
  if (source.width !== candidate.width || source.height !== candidate.height) throw Error('The complete viewport dimensions must match Source.');
  let differingPixels = 0, left = source.width, top = source.height, right = -1, bottom = -1;
  for (let index = 0; index < source.data.length; index += 4) {
    if (source.data[index] !== candidate.data[index] || source.data[index + 1] !== candidate.data[index + 1] ||
      source.data[index + 2] !== candidate.data[index + 2] || source.data[index + 3] !== candidate.data[index + 3]) {
      differingPixels++;
      const pixel = index / 4, x = pixel % source.width, y = Math.floor(pixel / source.width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  return {width: source.width, height: source.height, differingPixels,
    bounds: differingPixels ? {left, top, right: right + 1, bottom: bottom + 1} : null,
    sourcePixelSha256: await digest(source.data), rewritePixelSha256: await digest(candidate.data)};
}

/** Decode and compare in Chromium without copying full RGBA pages through IPC. */
export async function compareScreenshots(page, source, candidate) {
  return page.evaluate(compareExactRgba, {source: source.toString('base64'), candidate: candidate.toString('base64')});
}
