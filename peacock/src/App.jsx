import './App.css';
import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Heading, HeadingLevel } from 'baseui/heading';
import { StatefulSlider } from 'baseui/slider';
import { styled } from 'baseui';
import {Select, Value} from 'baseui/select';
import {expandBorderStyles} from 'baseui/styles';

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

const Room = () => {
  let { roomId } = useParams();
  const addr = window.location.host; // localhost:3500
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(`ws://${addr}/ws`, {
    onOpen: () => {
      sendJsonMessage({ event: 'join', id: roomId });
    }
  });
  const [roomState, setRoomState] = useState([]);
  const [userName, setUserName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentStyle, setCurrentStyle] = useState({ color: '#000000', lineWidth: 2 });
  const [previews, setPreviews] = useState({});

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  useEffect(() => {
    if (!lastJsonMessage)
      return;

    const m = lastJsonMessage;
    console.log(m);
    switch(m.event) {
    case 'assignedName':
      setUserName(m.name);
      break;
    case 'draw':
      setRoomState((prevState, _) => prevState.concat([m]));

      if (m.user != userName) {
        setPreviews((prevState, _) => ({ ...prevState, [m.user]: null }) );
      }
      break;
    case 'preview':
      if (m.user != userName) {
        setPreviews((prevState, _) => ({ ...prevState, [m.user]: m }) );
      }
      break;
    default:
      console.log(`unhandled event type ${m.event}`);
      break;
    }
  }, [lastJsonMessage, setRoomState, setPreviews, setUserName]);

  const onMouseMove = (event) => {
    if (!isDrawing)
      return;

    const p = { x: event.clientX - event.target.offsetLeft, y: event.clientY - event.target.offsetTop };
    setCurrentPath((prevState, _) => prevState.concat([p]));
    setPreviews((prevState, _) => ({ ...prevState, [userName]: {points: currentPath, style: currentStyle } }) );

    sendJsonMessage({ event: 'preview', ...previews[userName]});
  };

  const onMouseUp = (_) => {
    if (currentPath.length) {
      sendJsonMessage({ event: 'draw', points: currentPath, style: currentStyle });
      setRoomState((prevState, _) => prevState.concat([{points: currentPath, style: { ...currentStyle } }]));
      setCurrentPath([]);

      previews[userName] = null;
      setPreviews(previews);
    }
    setIsDrawing(false);
  };

  const onMouseDown = (_) => {
    setIsDrawing(true);

    previews[userName] = null;
    setPreviews(previews);
  };

  const drawEvent = (ctx, event, badge) => {
    ctx.save();
    ctx.lineWidth = event.style.lineWidth;
    ctx.strokeStyle = event.style.color;
    ctx.fillStyle = event.style.Color;
    ctx.beginPath();
    event.points.forEach(({ x, y }) => {
      ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (badge) {
      const last = event.points[event.points.length - 1];
      if (last) {
        ctx.fillText(badge, last.x + 10, last.y - 10);
      }
    }

    ctx.closePath();
    ctx.restore();
  };

  return (
    <div className="container">
      <div className="sidebar">
        <HeadingLevel>
          <Heading>{roomId}</Heading>
          <HeadingLevel>
            <Heading>{userName}</Heading>
          </HeadingLevel>
        </HeadingLevel>
        <div>
          <StatefulSlider
            min={1}
            max={10}
            initialState={{value: [currentStyle.lineWidth] }}
            onChange={
              ({value}) => {
                currentStyle.lineWidth = value[0];
                setCurrentStyle(currentStyle);
              }
            }
            onFinalChange={
              ({value}) => {
                currentStyle.lineWidth = value[0];
                setCurrentStyle(currentStyle);
              }
            }

          />
        </div>
        <div>
          <ColorPicker
            onChange={
              value => {
                currentStyle.color = value;
                setCurrentStyle(currentStyle);
              }
             }
          />
        </div>
      </div>
      <div className="content">
        <Canvas
          id="room"
          draw={
            (ctx) => {
              roomState.forEach((event) => drawEvent(ctx, event));

              for (let key in previews) {
                let event = previews[key];
                if (!event)
                  continue;

                drawEvent(ctx, event, key);
              };
            }
          }
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        />
      </div>
    </div>
  );
};

const ColorSwatch = styled(
  'div',
  (props) => {
    return {
      width: props.$theme.sizing.scale300,
      height: props.$theme.sizing.scale300,
      marginRight: props.$theme.sizing.scale200,
      display: 'inline-block',
      backgroundColor: props.$color,
      verticalAlign: 'baseline',
      ...expandBorderStyles(props.$theme.borders.border400),
    };
  },
);
const getLabel = ({option}) => {
  return (
    <React.Fragment>
      <ColorSwatch $color={option.color} />
      {option.id}
    </React.Fragment>
  );
};

const ColorPicker = ({onChange}) => {
  const [value, setValue] = useState([{id: 'Black', color: '#000000'}]);
  return (
    <Select
      options={[
        {id: 'Black', color: '#000000'},
        {id: 'Blue', color: '#0000FF'},
        {id: 'Green', color: '#00FF00'},
        {id: 'Red', color: '#FF0000'},
        {id: 'Gray', color: '#999999'},
      ]}
      clearable={false}
      searchable={false}
      deleteRemoves={false}
      escapeClearsValue={false}
      backspaceRemoves={false}
      required
      labelKey="id"
      valueKey="color"
      onChange={
        (options) => {
          setValue(options.value);
          onChange(options.value[0].color);
        }
      }
      value={value}
      getOptionLabel={getLabel}
      getValueLabel={getLabel}
    />
  );
};


export default App;
