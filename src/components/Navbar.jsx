import React, { useState } from 'react';
import './Components.css';

const NAV_ITEMS = [
  { label: 'Peta Sinyal',       href: '#peta',              icon: '🗺️' },
  { label: 'Perbandingan',      href: '#perbandingan',      icon: '📊' },
  { label: 'Speed Test',        href: '#speedtest',         icon: '🚀' },
  { label: 'Data Contribution', href: '#data-contribution', icon: '📈' },
  { label: 'Model Management',  href: '#model-management',  icon: '🤖' },
  { label: 'Tentang',           href: '#tentang',           icon: 'ℹ️' },
];

export default function Navbar({ activePage = 'peta', onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleClick = (e, page) => {
    e.preventDefault();
    setMenuOpen(false);
    if (onNavigate) onNavigate(page);
  };

  return (
    <nav className="navbar">
      <a
        href="#"
        className="navbar-brand"
        onClick={(e) => handleClick(e, 'peta')}
      >
        <span className="icon">📡</span>
        <span>SignalMap</span>
      </a>

      <button
        className="navbar-menu-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        {NAV_ITEMS.map((item) => {
          const page = item.href.replace('#', '');
          return (
            <li key={page}>
              <a
                href={item.href}
                className={activePage === page ? 'active' : ''}
                onClick={(e) => handleClick(e, page)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
