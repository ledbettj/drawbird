import { Text, Flex, CardHeader, Avatar, Box, Heading } from "@chakra-ui/react";
import Logo from './bird.png';

const RoomHeader = ({ name, connectionStatus, userName}) => {
  return (
    <CardHeader>
      <Flex spacing='4'>
        <Flex flex='1' gap='4' alignItems='center' flexWrap='wrap'>
          <Avatar src={Logo} name={userName.split('-').join(' ')} />
          <Box>
            <Heading size='sm'>{userName}</Heading>
            <Text>{name} | {connectionStatus}</Text>
          </Box>
        </Flex>
      </Flex>
    </CardHeader>
  );
};

export default RoomHeader;
