import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { UIKitPage } from './pages/UIKitPage';
import { AuctionPage } from './pages/AuctionPage';
import { PrototypeProvider } from './hooks/PrototypeContext';
import {
  HomePage,
  SearchPage,
  DetailPage,
  GuidePage,
  PatternsPage,
  NotFoundPage,
} from './pages/PrototypePages';
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = pathname === '/ui' ? 'Циан · UI kit' : 'Циан · Прототипы';
  }, [pathname]);
  return (
    <PrototypeProvider>
      <Routes>
        <Route path="/" element={import.meta.env.BASE_URL === '/' ? <HomePage /> : <AuctionPage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/listing/:id" element={<DetailPage />} />
        <Route path="/ui" element={<UIKitPage prototype />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/patterns" element={<PatternsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PrototypeProvider>
  );
}
