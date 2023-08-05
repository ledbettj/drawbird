import './App.css';
import Room from './Room';

import { Routes, Route } from 'react-router-dom';

const App = () => {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<div />} />
      </Routes>
    </div>
  );
};

const Home = () => {
  return (
    <div>Pick a room, bub</div>
  );
};


export default App;
