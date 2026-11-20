import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapPage from './pages/MapPage';
import ComparisonPage from './pages/ComparisonPage';
import AboutPage from './pages/AboutPage';
import SpeedTestPage from './pages/SpeedTestPage';
import ModelManagementPage from './pages/ModelManagementPage';
import DataContributionPage from './pages/DataContributionPage';
import { initDB } from './data/db';
import './App.css';
import './components/MLPages.css';

const VALID_PAGES = ['peta', 'perbandingan', 'tentang', 'speedtest', 'model-management', 'data-contribution'];

function getPageFromHash() {
  const hash = window.location.hash.replace('#', '') || 'peta';
  if (VALID_PAGES.includes(hash)) return hash;
  return 'peta';
}

export default function App() {
  const [page, setPage] = useState(getPageFromHash);

  useEffect(() => {
    initDB();
  }, []);

  useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (p) => {
    window.location.hash = p;
    setPage(p);
  };

  return (
    <div className="app">
      <Navbar activePage={page} onNavigate={navigate} />
      <main className="app-main">
        {page === 'peta' && <MapPage />}
        {page === 'perbandingan' && <ComparisonPage />}
        {page === 'tentang' && <AboutPage />}
        {page === 'speedtest' && <SpeedTestPage />}
        {page === 'model-management' && <ModelManagementPage />}
        {page === 'data-contribution' && <DataContributionPage />}
      </main>
    </div>
  );
}
