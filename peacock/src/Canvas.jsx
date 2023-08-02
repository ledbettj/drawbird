import { useRef, useState, useEffect } from 'react';

const Canvas = (props) => {
  const canvasRef = useRef(null);
  const { draw, ...rest } = props;
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    setWidth(canvas.clientWidth);
    setHeight(canvas.clientHeight);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let handle;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw(ctx);
      handle = window.requestAnimationFrame(render);
    };

    render();

    return () => { window.cancelAnimationFrame(handle); };
  }, [draw]);
  return (
    <canvas
      ref={canvasRef}
      height={height}
      width={width}
      {...rest}
    />
  );
};

export default Canvas;
