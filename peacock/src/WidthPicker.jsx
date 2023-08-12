import { useState } from 'react';
import { Slider, SliderFilledTrack, SliderMark, SliderThumb, SliderTrack } from '@chakra-ui/react';

const WidthPicker = ({ onChangeEnd, ...props }) => {
  const [value, setValue] = useState(props.defaultValue || 2);

  return (
    <Slider
      defaultValue={2}
      min={2}
      max={20}
      step={2}
      onChange={setValue}
      onChangeEnd={(v) => { onChangeEnd(v); setValue(v); }}
      {...props}
    >
      <SliderMark
        value={value}
        textAlign="center"
        mt="-8"
        ml="-6"
        w="12"
      >
        {value}
      </SliderMark>
      <SliderTrack>
        <SliderFilledTrack />
      </SliderTrack>
      <SliderThumb />
    </Slider>
  );
}

export default WidthPicker;
