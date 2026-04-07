import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerMenu from './pages/CustomerMenu';
import TrackOrder from './pages/TrackOrder';
import KitchenPanel from './pages/KitchenPanel';
import CounterPanel from './pages/CounterPanel';
import AdminDashboard from './pages/AdminDashboard';
import QRCodes from './pages/QRCodes';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/menu?table=1" replace />} />
        <Route path="/menu" element={<CustomerMenu />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/kitchen" element={<KitchenPanel />} />
        <Route path="/counter" element={<CounterPanel />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/qr-codes" element={<QRCodes />} />
      </Routes>
    </Router>
  );
}

export default App;
