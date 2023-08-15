class Painter {
  constructor(width, height, blobfish) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.blobfish = blobfish;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  erase() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  commit(op) {
    switch(op.event) {
    case 'draw':
      this.drawEvent(op);
      break;
    case 'fill': {
      let p = new this.blobfish.Point(op.point.x, op.point.y);
      this.blobfish.flood_fill(this.ctx, p, op.color);
      break;
    }
    default:
      console.log('unknown operation', op);
      break;
    }
  }

  getCanvas() {
    return this.canvas;
  }

  drawEventCanvas(ctx, event, badge) {

    if (!event.points.length)
      return;
    ctx.save();
    ctx.lineWidth = event.style.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = event.style.color;
    ctx.fillStyle = event.style.color;
    ctx.beginPath();

    ctx.moveTo(event.points[0].x, event.points[0].y);

    let i;

    if (event.points.length <= 3) {
      event.points.forEach(({ x, y }) => {
        ctx.lineTo(x, y);
      });
    } else {

      for (i = 1; i < event.points.length - 2; ++i) {
        let p = event.points;
        let xc = (p[i].x + p[i + 1].x) / 2;
        let yc = (p[i].y + p[i + 1].y) / 2;
        ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
      }

      ctx.quadraticCurveTo(event.points[i].x, event.points[i].y, event.points[i + 1].x, event.points[i + 1].y);
    }

    ctx.stroke();

    if (badge) {
      const last = event.points[event.points.length - 1];
      if (last) {
        ctx.fillText(badge, last.x + 10, last.y - 10);
      }
    }

    ctx.closePath();
    ctx.restore();
  }

  drawEvent(event, badge) {
    this.drawEventCanvas(this.ctx, event, badge);
  };
}


export default Painter;
