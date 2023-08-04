import Canvas from './Canvas';

import { Flex, Button, Divider, Square, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ListItem, List, ListIcon } from '@chakra-ui/react';
import { DeleteIcon, InfoIcon } from '@chakra-ui/icons';
import  { encode, decode } from '@msgpack/msgpack';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useWebSocket,  {ReadyState} from 'react-use-websocket';
import RoomHeader from './RoomHeader';
import { Card, CardBody} from '@chakra-ui/react';
import ColorPicker from './ColorPicker';
import WidthPicker from './WidthPicker';

const Room = () => {
  let { roomId } = useParams();
  const addr = window.location.hostname == 'localhost' ?
        'ws://localhost:3500/ws' :
        `wss://${window.location.host}/ws`
  ;
  const { sendMessage, lastMessage, readyState } = useWebSocket(addr, {
    shouldReconnect: (_) => true,
    reconnectAttempts: 10,
    reconnectInterval: (n) => (n * 1_000),
    retryOnError: true,
    onOpen: () => {
      sendMessage(encode({ event: 'join', id: roomId }));
    }
  });
  const [roomState, setRoomState] = useState([]);
  const [userName, setUserName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentStyle, setCurrentStyle] = useState({ color: '#000000', lineWidth: 2 });
  const [previews, setPreviews] = useState({});
  const [eventLog, setEventLog] = useState([]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'connecting...',
    [ReadyState.OPEN]: 'connected',
    [ReadyState.CLOSING]: 'closing...',
    [ReadyState.CLOSED]: 'disconnected',
    [ReadyState.UNINSTANTIATED]: 'all fucked up',
  }[readyState];

  const logEvent = (log, text) => {
    log = log.concat([text]);
    const idx = Math.max(log.length - 10, 0);
    return log.slice(idx, idx + 10);
  };

  useEffect(() => {
    const process = async () => {
      if (!lastMessage)
        return;

      const m = decode(await lastMessage.data.arrayBuffer());

      switch(m.event) {
      case 'assignedName':
        setEventLog((prevState, _) => logEvent(prevState, `Hello. You look like a ${m.name}.`));
        setUserName(m.name);
        break;
      case 'draw':
        setRoomState((prevState, _) => prevState.concat([m]));

        if (m.user != userName) {
          setPreviews((prevState, _) => ({ ...prevState, [m.user]: null }) );
        }
        break;
      case 'hover':
        if (m.user != userName) {
          setPreviews((prevState, _) => ({ ...prevState, [m.user]: { points: [m.point], style: { lineWidth: 0, color: 'rgba(0, 0, 0, 0%)' } }}));
        }
        break;
      case 'preview':
        if (m.user != userName) {
          setPreviews((prevState, _) => ({ ...prevState, [m.user]: m }) );
        }
        break;
      case 'erase':
        setEventLog((prevState, _) => logEvent(prevState, `${m.name} erased the canvas.  shame!`));
        setRoomState([]);
        break;
      case 'connect':
        if (m.user != userName) {
          setEventLog((prevState, _) => logEvent(prevState, `${m.user} flew into the room.`));
        }
        break;
      case 'disconnect':
        setEventLog((prevState, _) => logEvent(prevState, `${m.user} left.  Bye felicia!`));
        setPreviews((prevState, _) => ({ ...prevState, [m.user]: null }));
        break;
      default:
        console.log(`unhandled event type ${m.event}`);
        break;
      }
    };

    process().catch(console.error);
  }, [lastMessage, setRoomState, setPreviews, setUserName, setEventLog]);

  let lastMove = new Date();

  const onTouchStart = (event) => {
    onMouseDown(event.touches[0]);
    event.preventDefault();
  };

  const onTouchEnd = (event) => {
    onMouseUp({});
    event.preventDefault();
  };

  const onTouchMove = (event) => {
    onMouseMove(event.touches[0]);
    event.preventDefault();
  };

  const onMouseMove = (event) => {

    const p = { x: event.pageX - event.target.offsetLeft, y: event.pageY - event.target.offsetTop };

    if (!isDrawing) {
      if (new Date() - lastMove > 250) {
        sendMessage(encode({ event: 'hover', point: p }));
        lastMove = new Date();
      }
      return;
    }

    setCurrentPath((prevState, _) => prevState.concat([p]));
    setPreviews((prevState, _) => {
      const next = { ...prevState, [userName]: {points: currentPath, style: currentStyle } };
      sendMessage(encode({ event: 'preview', ...next[userName]}));
      return next;
    });
  };

  const onMouseUp = (_) => {
    if (currentPath.length) {
      sendMessage(encode({ event: 'draw', points: currentPath, style: currentStyle }));
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
    if (!event.points.length)
      return;

    ctx.save();
    ctx.lineWidth = event.style.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = event.style.color;
    ctx.fillStyle = event.style.Color;
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
  };

  const erase = () => {
    sendMessage(encode({ event: 'erase' }));
  };

  return (
    <Flex h="100vh" alignItems="stretch">
      <Square
        flexGrow="0"
        w="320px"
        alignItems="flex-start"
        justifyContent="flex-start">
        <Card w="100%" h="100%">
          <RoomHeader name={roomId} connectionStatus={connectionStatus} userName={userName} />
          <CardBody>
            <WidthPicker
              mb="8"
              onChangeEnd={
                (val) => { setCurrentStyle((prevState, _) => ({val, ...prevState, lineWidth: val})); }
              }
            />
            <ColorPicker
              mb="8"
              onChangeEnd={
                (val) => { setCurrentStyle((prevState, _) => ({val, ...prevState, color: val})); }
              }
            />
            <Button mb="8" colorScheme="red" leftIcon={<DeleteIcon />} onClick={erase}>Clear Drawing</Button>
            <Divider mb="8" />
            <List mb="8" spacing="3" fontFamily="monospace">
              {
                eventLog.map(event => (<ListItem>{event}</ListItem>))
              }
            </List>
          </CardBody>
        </Card>
      </Square>
      <Square flexGrow="1">
        <Modal isOpen={connectionStatus === 'disconnected'}>
        <ModalOverlay/>
          <ModalContent>
            <ModalHeader>Disconnected</ModalHeader>
            <ModalBody>
              Refresh the page to reconnect.  If the problem persists, the server might be down.
            </ModalBody>
          </ModalContent>
        </Modal>
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
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchMove}
        />
    </Square>
    </Flex>
  );
};

export default Room;
