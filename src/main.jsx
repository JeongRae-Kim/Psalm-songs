import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

// PWA 자동 업데이트: 새 버전 감지 시 즉시 적용 + 페이지 새로고침
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
