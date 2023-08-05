import { useEffect, useState } from 'react';
import { Box, ListItem, List } from '@chakra-ui/react';

const EventLog = ({ log, maxLength = 10, ...props}) => {
  const [eventLog, setEventLog] = useState([]);

  useEffect(() => {
    if (log.length <= maxLength) {
      setEventLog(log);
      return;
    }
    setEventLog(log.slice(log.length - maxLength, log.length));

  }, [log, maxLength]);

  return (
    <Box bg="gray.100" border="1px solid #d6d6d6" borderRadius={4} padding={2} fontSize="sm" mb="8" {...props}>
      <List spacing="3">
        { eventLog.map((event, index) => (<ListItem key={index}>&rsaquo; {event}</ListItem>)) }
      </List>
    </Box>
  );
};


export default EventLog;
