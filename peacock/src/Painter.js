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

  commit(op, badge) {
    this.doCommit(this.ctx, op);
  }

  doCommit(ctx, op, badge) {
    switch(op.event) {
    case 'draw':
      switch(op.kind) {
      case 'draw':
        this.drawEventCanvas(ctx, op, badge);
        break;
      default:
        this.drawShape(ctx, op, badge);
        break;
      }
      break;
    case 'fill': {
      let p = new this.blobfish.Point(op.point.x, op.point.y);
      this.blobfish.flood_fill(ctx, p, op.color);
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

  drawShape(ctx, op, badge) {
    if (op.points.length < 2)
      return;

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = op.style.lineWidth;
    ctx.fillStyle = op.style.color;
    ctx.strokeStyle = op.style.color;
    ctx.lineCaps = 'round';
    ctx.lineJoin = 'round';

    switch(op.kind) {
    case 'line':
      ctx.moveTo(op.points[0].x, op.points[0].y);
      ctx.lineTo(op.points[1].x, op.points[1].y);
      ctx.stroke();
      break;
    case 'strokeRect':
      ctx.strokeRect(op.points[0].x, op.points[0].y, op.points[1].x - op.points[0].x, op.points[1].y - op.points[0].y);
      break;
    case 'fillRect':
      ctx.fillRect(op.points[0].x, op.points[0].y, op.points[1].x - op.points[0].x, op.points[1].y - op.points[0].y);
      break;
    case 'strokeOval': {
      const x = (op.points[0].x + op.points[1].x) / 2.0;
      const y = (op.points[0].y + op.points[1].y) / 2.0;
      const rx = Math.abs(op.points[0].x - op.points[1].x);
      const ry = Math.abs(op.points[0].y - op.points[1].y);
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'fillOval':
      const x = (op.points[0].x + op.points[1].x) / 2.0;
      const y = (op.points[0].y + op.points[1].y) / 2.0;
      const rx = Math.abs(op.points[0].x - op.points[1].x);
      const ry = Math.abs(op.points[0].y - op.points[1].y);
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    ctx.closePath();
    ctx.restore();
  }

  previewEvent(ctx, event, badge) {
    this.doCommit(ctx, event, badge);
  }

  drawEventCanvas(ctx, event, badge) {
    this.blobfish.stroke_line(ctx, event.points, event.style.color, event.style.lineWidth, badge);
  }
}


export default Painter;
