
import { useState, useEffect } from "react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto
      bg-accent text-accent-text rounded-lg shadow-lg
      px-4 py-3 flex items-center justify-between z-50"
    >
      <span className="text-sm">홈 화면에 추가하면 앱처럼 사용할 수 있어요</span>
      <div className="flex gap-2 shrink-0 ml-3">
        <button
          onClick={() => setDismissed(true)}
          className="text-xs opacity-70 hover:opacity-100"
        >
          닫기
        </button>
        <button
          onClick={handleInstall}
          className="text-xs bg-accent-text text-accent px-3 py-1 rounded-md
            font-medium hover:opacity-90"
        >
          설치
        </button>
      </div>
    </div>
  );
}