import Canvas from './Canvas';

import { Flex, Button, Icon, Square, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, Grid, GridItem, IconButton } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import  { encode, decode } from '@msgpack/msgpack';
import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import useWebSocket,  {ReadyState} from 'react-use-websocket';
import RoomHeader from './RoomHeader';
import { Card, CardBody} from '@chakra-ui/react';
import ColorPicker from './ColorPicker';
import WidthPicker from './WidthPicker';
import EventLog from './EventLog';
import { GrEdit, GrPaint } from 'react-icons/gr';
import { BsCircle, BsCircleFill, BsSlashLg, BsSquare, BsSquareFill } from 'react-icons/bs';
import { BlobFishContext } from './BlobFish';
import Painter from './Painter';

const Room = () => {
  const blobfish = useContext(BlobFishContext);
  let { roomId } = useParams();
  const addr = window.location.hostname === 'localhost' ?
        'ws://localhost:3500/ws' :
        `wss://${window.location.host}/ws`
  ;
  const { sendMessage, lastMessage, readyState } = useWebSocket(addr, {
    shouldReconnect: (_) => true,
    reconnectAttempts: 10,
    reconnectInterval: (n) => (n * 1_000),
    retryOnError: true,
    onOpen: () => broadcast({ event: 'join', id: roomId })
  });

  const broadcast = (msg) => {
    msg.uuid = crypto.randomUUID();
    sendMessage(encode(msg));
  };

  const [userName, setUserName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentStyle, setCurrentStyle] = useState({ color: '#000000', lineWidth: 2 });
  const [previews, setPreviews] = useState({});
  const [eventLog, setEventLog] = useState([]);
  const [drawMode, setDrawMode] = useState('draw');
  const [painter, ] = useState(new Painter(3440, 1920, blobfish));

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'connecting...',
    [ReadyState.OPEN]: 'connected',
    [ReadyState.CLOSING]: 'closing...',
    [ReadyState.CLOSED]: 'disconnected',
    [ReadyState.UNINSTANTIATED]: 'all fucked up',
  }[readyState];

  useEffect(() => {
    const process = async () => {
      if (!lastMessage)
        return;

      const m = decode(await lastMessage.data.arrayBuffer());

      switch(m.event) {
      case 'assignedName':
        setEventLog((prevState, _) => prevState.concat([`Hello. You look like a ${m.name}.`]));
        setUserName(m.name);
        break;
      case 'draw':
      case 'fill':
        painter.commit(m);
        setPreviews((prevState, _) => ({ ...prevState, [m.user]: null }) );
        break;
      case 'hover':
        if (m.user !== userName) {
          setPreviews((prevState, _) => ({ ...prevState, [m.user]: { points: [m.point], style: { lineWidth: 0, color: 'rgba(0, 0, 0, 0%)' } }}));
        }
        break;
      case 'preview':
        if (m.user !== userName) {
          setPreviews((prevState, _) => ({ ...prevState, [m.user]: m }) );
        }
        break;
      case 'erase':
        setEventLog((prevState, _) => prevState.concat([`${m.user} erased the canvas.  shame!`]));
        painter.erase();
        break;
      case 'connect':
        if (m.user !== userName) {
          setEventLog((prevState, _) => prevState.concat([`${m.user} joined.`]));
        }
        break;
      case 'disconnect':
        setEventLog((prevState, _) => prevState.concat([`${m.user} left.  Bye felicia!`]));
        setPreviews((prevState, _) => ({ ...prevState, [m.user]: null }));
        break;
      default:
        console.log(`unhandled event type ${m.event}`);
        break;
      }
    };

    process().catch(console.error);
  }, [lastMessage, setPreviews, setUserName, setEventLog, userName, painter]);

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
        broadcast({ event: 'hover', point: p });
        lastMove = new Date();
      }
      return;
    }

    switch(drawMode) {
    case 'draw':
      setCurrentPath((prevState, _) => prevState.concat([p]));
      break;
    default:
      setCurrentPath((prevState, _) => {
        if (prevState.length == 1) {
          return prevState.concat([p]);
        } else {
          prevState[1] = p;
          return prevState;
        }
      });
      break;
    };

    setPreviews((prevState, _) => {
      const next = { ...prevState, [userName]: { event: 'draw', points: currentPath, kind: drawMode, style: currentStyle } };
      broadcast({ ...next[userName], event: 'preview' });
      return next;
    });
  };

  const onMouseUp = (event) => {
    if (!isDrawing)
      return;

    const p = { x: event.pageX - event.target.offsetLeft, y: event.pageY - event.target.offsetTop };

    switch(drawMode) {
    case 'draw':
      if (currentPath.length) {
        broadcast({ event: 'draw', kind: drawMode, points: currentPath, style: currentStyle });
        setCurrentPath([]);
      }
    default:
      if (currentPath.length > 1) {
        broadcast({ event: 'draw', kind: drawMode, points: currentPath, style: currentStyle });
        setCurrentPath([]);
      }
      break;
    };

    setIsDrawing(false);
  };

  const onMouseDown = (event) => {
    const p = { x: event.pageX - event.target.offsetLeft, y: event.pageY - event.target.offsetTop };

    // ignore middle or right clicks.
    if (event.button) {
      return;
    }
    setIsDrawing(drawMode !== 'fill');

    switch(drawMode) {
    case 'fill':
      broadcast({ event: 'fill', point: p, color: currentStyle.color });
      break;
    default:
      setCurrentPath([p]);
      previews[userName] = null;
      setPreviews(previews);
      break;
    }
  };

  const erase = () => {
    broadcast({ event: 'erase' });
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
            <Grid gap={4} mb="8" templateColumns='repeat(5, 1fr)'>
              <GridItem>
                <IconButton icon={<Icon as={GrEdit}/>} onClick={() => setDrawMode('draw')} colorScheme="cyan" variant="outline" isActive={ drawMode === 'draw'} />
              </GridItem>
              <GridItem>
                <IconButton icon={<Icon as={GrPaint} />} onClick={() => setDrawMode('fill')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'fill' } />
              </GridItem>
              <GridItem>
                <IconButton icon={<Icon as={BsSlashLg} color="black" />} onClick={() => setDrawMode('line')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'line' } />

              </GridItem>
              <GridItem/>
              <GridItem/>
              <GridItem>
                <IconButton icon={<Icon as={BsCircleFill} color="black" />} onClick={() => setDrawMode('fillOval')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'fillOval' } />
              </GridItem>
              <GridItem>
                <IconButton icon={<Icon as={BsSquareFill} color="black"/>} onClick={() => setDrawMode('fillRect')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'fillRect' } />
              </GridItem>
              <GridItem>
                <IconButton icon={<Icon as={BsCircle} color="black"/>} onClick={() => setDrawMode('strokeOval')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'strokeOval' } />
              </GridItem>
              <GridItem>
    <IconButton icon={<Icon as={BsSquare}  color="black" />} onClick={() => setDrawMode('strokeRect')} colorScheme="cyan" variant="outline"  isActive={ drawMode === 'strokeRect' } />
              </GridItem>

            </Grid>
            <WidthPicker
              mb="4"
              onChangeEnd={
                (val) => { setCurrentStyle((prevState, _) => ({val, ...prevState, lineWidth: val})); }
              }
            />
            <ColorPicker
              mb="4"
              onChangeEnd={
                (val) => { setCurrentStyle((prevState, _) => ({val, ...prevState, color: val})); }
              }
            />
            {/* <Button mb="1" variant="outline" colorScheme="blue" display="block" width="full" leftIcon={<ArrowBackIcon />} onClick={() => {}}>Undo</Button> */}
            <Button mb="4" colorScheme="red" display="block" width="full" leftIcon={<DeleteIcon />} onClick={erase}>Clear Drawing</Button>
            <EventLog maxLength={10} log={eventLog} />
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
              ctx.drawImage(painter.getCanvas(), 0, 0);

              for (let key in previews) {
                let event = previews[key];
                if (!event)
                  continue;

                painter.previewEvent(ctx, event, key);
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
