import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import NewRequest from './pages/NewRequest';
import RequestDetail from './pages/RequestDetail';
import Broadcasts from './pages/Broadcasts';
import FundingEntities from './pages/FundingEntities';
import Companies from './pages/Companies';
import Brokers from './pages/Brokers';
import Attendance from './pages/Attendance';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
      <Route path="/request/new" element={<PrivateRoute><NewRequest /></PrivateRoute>} />
      <Route path="/request/:id" element={<PrivateRoute><RequestDetail /></PrivateRoute>} />
      <Route path="/broadcasts" element={<PrivateRoute><Broadcasts /></PrivateRoute>} />
      <Route path="/funding-entities" element={<AdminRoute><FundingEntities /></AdminRoute>} />
      <Route path="/companies" element={<AdminRoute><Companies /></AdminRoute>} />
      <Route path="/brokers" element={<PrivateRoute><Brokers /></PrivateRoute>} />
      <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}


