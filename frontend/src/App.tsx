import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DirtyStateProvider } from './context/DirtyStateContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { ProtectedRoute } from './components/ProtectedRoute'; 
import SubjectDetail from './pages/SubjectDetail';
import Messages from './pages/Messages';
import CalendarPage from './pages/Calendar';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DirtyStateProvider>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* 🛡️ RUTAS PROTEGIDAS */}
          {/* Todo lo que pongas aquí adentro requiere login */}
          <Route element={<ProtectedRoute />}>
             <Route path="/dashboard" element={<Dashboard />} />
             <Route path="/profile" element={<Profile />} />
             <Route path="/subject/:id" element={<SubjectDetail />} />
             <Route path="/messages" element={<Messages />} />
             <Route path="/calendar" element={<CalendarPage />} />
          </Route>

          {/* Redirección raíz */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Comodín (404) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </DirtyStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;