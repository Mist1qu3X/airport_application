import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-icon">✈</span>
          <span className="logo-text">SkyControl</span>
        </Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link to="/profile" className="nav-link">
                <span className="nav-avatar">{user.username[0].toUpperCase()}</span>
                {user.username}
              </Link>
              {(user.role === 'admin' || user.role === 'developer') && (
                <Link to="/admin" className="nav-link">Админ</Link>
              )}
              <button onClick={handleLogout} className="btn btn-outline btn-sm">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">Вход</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Регистрация</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}