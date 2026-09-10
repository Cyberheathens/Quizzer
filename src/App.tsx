import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';
import CreateRoomPage from './pages/CreateRoomPage';

export default function App() {
  return (
    <>
<div className="fixed inset-0 -z-10 overflow-hidden noise">
        <div className="absolute inset-0 grid-bg" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] opacity-[0.14] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgb(255 131 89 / 0.55), rgb(230 62 122 / 0.25) 45%, transparent 70%)' }}
        />
      </div>

      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/room/:code/*" element={<RoomPage />} />
        </Routes>
      </AnimatePresence>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#150d1d',
            color: '#f1f5f9',
            border: '1px solid #2a2a3e',
            backdropFilter: 'blur(20px)',
          },
        }}
      />
    </>
  );
}
