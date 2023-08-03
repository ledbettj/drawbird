import React, { useState } from "react";
import { Button, SimpleGrid } from "@chakra-ui/react";

const ColorPicker = ({ onChangeEnd, ...props }) => {
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
    <SimpleGrid columns={5} spacing={2} {...props}>
      {colors.map((c) => (
        <Button
          key={c}
          aria-label={c}
          background={c}
          border={ color === c ? `4px inset #000` : "1px solid #c0c0c0" }
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
  );
};

export default ColorPicker;
