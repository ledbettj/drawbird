import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { ChakraProvider } from '@chakra-ui/react'
import { BlobFishProvider } from './BlobFish';

import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
document.body.addEventListener("touchstart", function (e) {
  if (e.target.id === 'room') {
    e.preventDefault();
  }
}, false);
document.body.addEventListener("touchend", function (e) {
  if (e.target.id === 'room') {
    e.preventDefault();
  }
}, false);
document.body.addEventListener("touchmove", function (e) {
  if (e.target.id === 'room') {
    e.preventDefault();
  }
}, false);

root.render(
  <React.StrictMode>
      <ChakraProvider>
        <BlobFishProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </BlobFishProvider>
      </ChakraProvider>
  </React.StrictMode>
);
