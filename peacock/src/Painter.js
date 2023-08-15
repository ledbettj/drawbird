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
    this.blobfish.stroke_line(ctx, event.points, event.style.color, event.style.lineWidth, badge);
  }

  drawEvent(event, badge) {
    this.drawEventCanvas(this.ctx, event, badge);
  };
}


export default Painter;
