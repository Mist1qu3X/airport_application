import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar';
import FlightSearch from './components/FlightSearch';
import FlightResults from './components/FlightResults';
import FlightDetail from './components/FlightDetail';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        <div className="main-container">
          <Routes>
            <Route path="/" element={<FlightSearch />} />
            <Route path="/results" element={<FlightResults />} />
            <Route path="/flight/:id" element={<FlightDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </div>
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={darkMode ? 'dark' : 'light'}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;