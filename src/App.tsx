import { Routes, Route, Navigate } from 'react-router-dom';
import Chat from './pages/Chat';

function App() {
  return (
    <div className="p-4">
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </div>
  );
}

export default App;