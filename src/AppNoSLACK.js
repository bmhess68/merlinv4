// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import MapPage from './components/MapPage';

function App() {
  return (
      <Router>
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/" element={<Login />} />
          </Routes>
      </Router>
  );
}

export default App;