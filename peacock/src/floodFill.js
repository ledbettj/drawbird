// adapted from https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
const colorToRgba = (color) => {
  if (color[0] === "#") {
    color = color.replace("#", "");
    const bigint = parseInt(color, 16);
    return ({
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
      a: 255
    });
  }

  throw `error: can't convert ${color} to rgba`;
}
const floodFill = (ctx, { x, y }, color) => {
  const canvas = ctx.canvas;

  let pixelStack = [{ x: x, y: y }];
  let pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let linearCoords = (y * canvas.width + x) * 4;
  let origColor = {
    r: pixels.data[linearCoords],
    g: pixels.data[linearCoords + 1],
    b: pixels.data[linearCoords + 2],
    a: pixels.data[linearCoords + 3]
  };

  color = colorToRgba(color);

  while (pixelStack.length > 0) {
    let newPixel = pixelStack.shift();
    x = newPixel.x;
    y = newPixel.y;

    linearCoords = (y * canvas.width + x) * 4;

    while (y-- >= 0 &&
      (pixels.data[linearCoords] === origColor.r &&
        pixels.data[linearCoords + 1] === origColor.g &&
        pixels.data[linearCoords + 2] === origColor.b &&
        pixels.data[linearCoords + 3] === origColor.a)) {
      linearCoords -= canvas.width * 4;
    }

    linearCoords += canvas.width * 4;
    y++;

    let reachedLeft = false;
    let reachedRight = false;

    while (y++ < canvas.height &&
      (pixels.data[linearCoords] === origColor.r &&
        pixels.data[linearCoords + 1] === origColor.g &&
        pixels.data[linearCoords + 2] === origColor.b &&
        pixels.data[linearCoords + 3] === origColor.a)) {
      pixels.data[linearCoords] = color.r;
      pixels.data[linearCoords + 1] = color.g;
      pixels.data[linearCoords + 2] = color.b;
      pixels.data[linearCoords + 3] = color.a;
      if (x > 0) {
        if (pixels.data[linearCoords - 4] === origColor.r &&
          pixels.data[linearCoords - 4 + 1] === origColor.g &&
          pixels.data[linearCoords - 4 + 2] === origColor.b &&
          pixels.data[linearCoords - 4 + 3] === origColor.a) {
          if (!reachedLeft) {
            pixelStack.push({
              x: x - 1,
              y: y
            });
            reachedLeft = true;
          }
        } else if (reachedLeft) {
          reachedLeft = false;
        }
      }
      if (x < canvas.width - 1) {
        if (pixels.data[linearCoords + 4] === origColor.r &&
          pixels.data[linearCoords + 4 + 1] === origColor.g &&
          pixels.data[linearCoords + 4 + 2] === origColor.b &&
          pixels.data[linearCoords + 4 + 3] === origColor.a) {
          if (!reachedRight) {
            pixelStack.push({
              x: x + 1,
              y: y
            });
            reachedRight = true;
          }
        } else if (reachedRight) {
          reachedRight = false;
        }
      }
      linearCoords += canvas.width * 4;
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

export default floodFill;
