import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import FlightSearch from './components/FlightSearch';
import FlightResults from './components/FlightResults';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import { AuthProvider } from './contexts/AuthContext';
import FlightDetail from './components/FlightDetail';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          <Routes>
            <Route path="/" element={<FlightSearch />} />
            <Route path="/results" element={<FlightResults />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/flight/:id" element={<FlightDetail />} />
          </Routes>
          <footer style={{
            textAlign: 'center',
            padding: '30px 20px',
            color: 'var(--text-light)',
            fontSize: '0.9rem',
            borderTop: '1px solid var(--border)',
            marginTop: '40px'
          }}>
            © 2026 SkyControl. Все права защищены. Учебный проект.
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;