import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { ProtectedRoute } from './components/ProtectedRoute'; 
import SubjectDetail from './pages/SubjectDetail';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* 🛡️ RUTAS PROTEGIDAS */}
          {/* Todo lo que pongas aquí adentro requiere login */}
          <Route element={<ProtectedRoute />}>
             <Route path="/dashboard" element={<Dashboard />} />
             <Route path="/profile" element={<Profile />} />
             <Route path="/subject/:id" element={<SubjectDetail />} />
          </Route>

          {/* Redirección raíz */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Comodín (404) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;