import { useEffect, useState, createContext } from 'react';
import { Spinner } from '@chakra-ui/react';

export const BlobFishContext = createContext({
  loading: true,
});

export const BlobFishProvider = ({ children }) => {
  const [value, setValue] = useState({ loading: true });

  useEffect(() => {
    let script = document.createElement('script');
    script.src = "/pkg/blobfish.js";
    script.type = "module";
    script.onload = () => {
      const load = async () => {
        const mod = await import('./pkg/blobfish.js');
        mod.default();
        setValue(mod);
      };
      load();
    };

    document.body.appendChild(script);

  }, []);

  return (
    <BlobFishContext.Provider value={value}>
      {
        value.loading ?
          (<Spinner/>)
          :
          children
      }
    </BlobFishContext.Provider>
  );
};
