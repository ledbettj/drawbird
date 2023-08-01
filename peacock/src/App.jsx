import './App.css';
import { useEffect, useState, useRef } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Heading, HeadingLevel } from 'baseui/heading';
import useWebSocket,  {ReadyState} from 'react-use-websocket';

const App = () => {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<div/>} />
      </Routes>
    </div>
  );
};

const Home = () => {
  return (
    <div/>
  );
};

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
      draw(ctx);
      handle = window.requestAnimationFrame(render);
    };

    render();

    return () => { window.cancelAnimationFrame(handle); };
  }, [draw]);
  return (<canvas ref={canvasRef} height={height} width={width} {...rest} />);
};

const Room = () => {
  let { roomId } = useParams();
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket('ws://localhost:3500/ws', {
    onOpen: () => {
      sendJsonMessage({ event: 'Join', id: roomId });
    }
  });
  const [roomState, setRoomState] = useState([]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  useEffect(() => {
    if (lastJsonMessage?.data)
      setRoomState(roomState.concat(lastJsonMessage.data));
  }, [lastJsonMessage, setRoomState]);

  return (
    <div className="container">
      <div className="sidebar">
        <HeadingLevel>
          <Heading>{roomId}</Heading>
        </HeadingLevel>
      </div>
      <div className="content">
        <Canvas id="room" draw={
          (ctx) => {
            ctx.fillText(roomState.join(','), 0, 12, 800);
          }
        }/>
      </div>
    </div>
  );
};

export default App;
