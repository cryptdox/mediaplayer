import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PlayerProvider } from './lib/player';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { SearchPage } from './pages/Search';
import { CollectionPage, GenrePage, LibraryPage, LikedPage, RecentPage } from './pages/Lists';

// Public player for the music uploaded in batools (mp_ tables). No sign-in:
// liked songs, recently played and the queue are kept on this device.
export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/liked" element={<LikedPage />} />
            <Route path="/library/recent" element={<RecentPage />} />
            <Route path="/c/:id" element={<CollectionPage />} />
            <Route path="/genre/:id" element={<GenrePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </PlayerProvider>
    </BrowserRouter>
  );
}
