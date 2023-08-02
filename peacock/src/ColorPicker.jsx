import React, { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  Button,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Center,
  SimpleGrid,
  Input,
  Text,
} from "@chakra-ui/react";

const ColorPicker = ({ onChangeEnd }) => {
  const [color, setColor] = useState("black");

  const colors = [
    "black",
    "red",
    "gray",
    "green",
    "blue",
    "yellow",
    "orange",
    "purple",
    "pink",
    "white",
  ];

  return (
    <Center marginTop={5}>
      <Popover variant="picker">
        <PopoverTrigger>
          <Button
            variant="outline"
            colorScheme="gray"
            aria-label={color}
            background={color}
            height="32px"
            width="100%"
            padding={0}
            minWidth="unset"
            borderRadius={3}
          >
            {color}
          </Button>
        </PopoverTrigger>
        <PopoverContent width="100%">
          <PopoverArrow bg={color} />
          <PopoverCloseButton color="white" />
          <PopoverHeader
            height="100px"
            backgroundColor={color}
            borderTopLeftRadius={5}
            borderTopRightRadius={5}
            color="white"
          >
            <Center height="100%">{color}</Center>
          </PopoverHeader>
          <PopoverBody height="120px">
            <SimpleGrid columns={5} spacing={2}>
              {colors.map((c) => (
                <Button
                  key={c}
                  aria-label={c}
                  background={c}
                  height="32px"
                  width="32px"
                  padding={0}
                  minWidth="unset"
                  borderRadius={3}
                  _hover={{ background: c }}
                  onClick={() => {
                    setColor(c);
                    onChangeEnd(c);
                  }}
                ></Button>
              ))}
            </SimpleGrid>
            <Input
              borderRadius={3}
              marginTop={3}
              placeholder="red.100"
              size="sm"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                onChangeEnd(e.target.value);
              }}
            />
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Center>
  );
};

export default ColorPicker;
