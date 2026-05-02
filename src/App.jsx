
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SongDetailPage from "./pages/SongDetailPage";
import SettingsPage from "./pages/SettingsPage";
import InstallBanner from "./components/InstallBanner";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/song/:id" element={<SongDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <InstallBanner />
    </BrowserRouter>
  );
}