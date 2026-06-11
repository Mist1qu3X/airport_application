// src/components/Navbar.tsx
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Navbar({ darkMode, toggleDarkMode }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-icon">✈</span>
          <span className="logo-text">SkyControl</span>
        </Link>

        <div className="nav-links">
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
            aria-label="Переключить тему"
          >
            <FontAwesomeIcon 
              icon={darkMode ? faSun : faMoon} 
              className="theme-icon"
            />
          </button>

          {user ? (
            <>
              <Link to="/profile" className="nav-link">
                <span className="nav-avatar">
                  {user.username[0].toUpperCase()}
                </span>
                {user.full_name || user.username}
              </Link>

              {(user.role === 'admin' || user.role === 'developer') && (
                <Link to="/admin" className="nav-link">
                  Админ
                </Link>
              )}

              <button 
                onClick={handleLogout} 
                className="btn btn-outline btn-sm"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Вход
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}