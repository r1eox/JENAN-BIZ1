import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewRequest from './pages/NewRequest';
import RequestDetail from './pages/RequestDetail';
import Broadcasts from './pages/Broadcasts';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/request/new" element={<PrivateRoute><NewRequest /></PrivateRoute>} />
      <Route path="/request/:id" element={<PrivateRoute><RequestDetail /></PrivateRoute>} />
      <Route path="/broadcasts" element={<PrivateRoute><Broadcasts /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

