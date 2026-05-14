import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SongDetailPage from "./pages/SongDetailPage";
import SettingsPage from "./pages/SettingsPage";
import PlaylistPage from "./pages/PlaylistPage";
import InstallBanner from "./components/InstallBanner";
import { PlaylistProvider } from "./contexts/PlaylistContext";
import { PlaybackProvider } from "./contexts/PlaybackContext";
import { PlayerProvider } from "./contexts/PlayerContext";

export default function App() {
  return (
    <BrowserRouter>
      <PlaylistProvider>
        <PlaybackProvider>
          <PlayerProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/song/:id" element={<SongDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/playlist" element={<PlaylistPage />} />
            </Routes>
            <InstallBanner />
          </PlayerProvider>
        </PlaybackProvider>
      </PlaylistProvider>
    </BrowserRouter>
  );
}
