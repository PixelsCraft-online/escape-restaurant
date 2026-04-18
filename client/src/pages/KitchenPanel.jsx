import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../socket/useSocket';

// Animation variants - inspired by Apple HIG & Material Design motion
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { 
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  },
  exit: { 
    opacity: 0, scale: 0.9, y: -20,
    transition: { duration: 0.2, ease: "easeIn" }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } }
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.02, 1],
    boxShadow: [
      "0 0 0 0 rgba(239, 68, 68, 0)",
      "0 0 0 8px rgba(239, 68, 68, 0.3)",
      "0 0 0 0 rgba(239, 68, 68, 0)"
    ],
    transition: { duration: 2, repeat: Infinity }
  }
};

const KitchenPanel = () => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('grid'); // grid | list
  
  const audioCtxRef = useRef(null);
  const socket = useSocket(isAuthenticated ? 'join_staff' : null, { pin });

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio play failed:", e);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === import.meta.env.VITE_ADMIN_PIN) setIsAuthenticated(true);
    else alert('Invalid PIN');
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    const fetchActiveOrders = async () => {
      try {
        const res = await axios.get('/api/orders', { headers: { 'x-admin-pin': pin } });
        const kitchenOrders = res.data.filter(o => ['PENDING', 'IN_PROGRESS', 'PARTIALLY_READY'].includes(o.status));
        setOrders(kitchenOrders);
      } catch (err) {
        console.error('Failed to fetch orders', err);
        if (err.response?.status === 401) setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveOrders();
  }, [isAuthenticated, pin]);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_order', (order) => { setOrders(prev => [...prev, order]); playBeep(); });
    socket.on('order_updated', (updatedOrder) => { setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)); });
    socket.on('item_status_update', ({ orderItem }) => {
      setOrders(prev => prev.map(order => {
        if (order.id !== orderItem.orderId) return order;
        return { ...order, items: order.items.map(item => item.id === orderItem.id ? orderItem : item) };
      }));
    });
    socket.on('order_completed', (completedOrder) => { setOrders(prev => prev.filter(o => o.id !== completedOrder.id)); });
    socket.on('bill_generated', (bill) => { setOrders(prev => prev.filter(o => o.id !== bill.orderId)); });
    return () => { socket.off('new_order'); socket.off('order_updated'); socket.off('item_status_update'); socket.off('order_completed'); socket.off('bill_generated'); };
  }, [socket, soundEnabled]);

  const handleItemAction = async (orderItemId, action) => {
    try {
      if (socket) socket.emit('item_action', { orderItemId, action });
      else await axios.patch(`/api/order-items/${orderItemId}`, { 
        itemStatus: action === 'DONE' ? 'DONE' : action === 'OOS' ? 'OUT_OF_STOCK' : 'SKIPPED'
      }, { headers: { 'x-admin-pin': pin } });
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const handleDeliver = async (orderId) => {
    try {
      if (socket) socket.emit('mark_delivered', { orderId });
      else await axios.patch(`/api/orders/${orderId}/complete`, {}, { headers: { 'x-admin-pin': pin } });
    } catch (err) {
      console.error('Deliver failed:', err);
    }
  };

  // Calculate urgency based on order time
  const getUrgency = (createdAt) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins >= 15) return { level: 'critical', color: 'red', label: `${mins}m`, bg: 'from-red-500/20 to-red-600/10' };
    if (mins >= 10) return { level: 'warning', color: 'amber', label: `${mins}m`, bg: 'from-amber-500/20 to-amber-600/10' };
    return { level: 'normal', color: 'emerald', label: `${mins}m`, bg: 'from-slate-800/50 to-slate-900/50' };
  };

  // Login Screen - Premium glassmorphism design
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.form 
          onSubmit={handleLogin} 
          className="relative z-10 bg-white/5 backdrop-blur-2xl p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white/10"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <motion.div 
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-24 h-24 bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Kitchen</h1>
            <p className="text-slate-400 mt-2 text-lg">Enter PIN to start cooking</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <input 
              type="password" 
              placeholder="• • • • • • • •" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl mb-6 text-center tracking-[0.5em] font-mono text-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-white placeholder-slate-600 transition-all"
              autoFocus
            />
          </motion.div>
          
          <motion.button 
            type="submit" 
            className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-400 hover:via-red-400 hover:to-pink-400 py-5 rounded-2xl font-bold text-white text-xl transition-all shadow-2xl shadow-orange-500/25 hover:shadow-orange-500/40"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Enter Kitchen
          </motion.button>
        </motion.form>
      </div>
    );
  }

  const pendingItems = orders.flatMap(o => o.items.filter(i => i.itemStatus === 'PENDING'));
  const inProgressItems = orders.flatMap(o => o.items.filter(i => i.itemStatus === 'IN_PROGRESS'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header - Glassmorphism style inspired by Apple */}
      <motion.header 
        className="bg-slate-900/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4 sticky top-0 z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center max-w-[2000px] mx-auto">
          <div className="flex items-center gap-5">
            <motion.div 
              className="w-14 h-14 bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048" />
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Kitchen Display</h1>
              <p className="text-sm text-slate-500">Escape Restaurant</p>
            </div>
          </div>

          {/* Stats Pills */}
          <div className="flex items-center gap-3">
            <motion.div 
              className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-full"
              whileHover={{ scale: 1.05 }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-amber-400 font-bold">{pendingItems.length}</span>
              <span className="text-amber-400/70 text-sm">Pending</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 rounded-full"
              whileHover={{ scale: 1.05 }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-cyan-400 font-bold">{inProgressItems.length}</span>
              <span className="text-cyan-400/70 text-sm">Cooking</span>
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
              {['grid', 'list'].map(v => (
                <motion.button
                  key={v}
                  onClick={() => setView(v)}
                  className={`p-2.5 rounded-lg transition-all ${view === v ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                  whileTap={{ scale: 0.95 }}
                >
                  {v === 'grid' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Sound Toggle */}
            <motion.button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-3 rounded-xl border transition-all ${soundEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {soundEnabled ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </motion.button>

            {/* Time */}
            <div className="text-right pl-4 border-l border-slate-700/50">
              <p className="text-3xl font-black text-white font-mono tracking-tight">
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="p-6 max-w-[2000px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-[70vh]">
            <motion.div 
              className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : orders.length === 0 ? (
          <motion.div 
            className="flex flex-col items-center justify-center h-[70vh] text-slate-500"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div 
              className="w-32 h-32 bg-slate-800/50 rounded-full flex items-center justify-center mb-8"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.div>
            <p className="text-2xl font-bold text-slate-400">No orders in queue</p>
            <p className="text-slate-600 mt-2">New orders will appear here automatically</p>
          </motion.div>
        ) : (
          <motion.div 
            className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5' : 'space-y-4'}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {orders.map(order => {
                const urgency = getUrgency(order.createdAt);
                const pendingCount = order.items.filter(i => i.itemStatus === 'PENDING').length;
                const doneCount = order.items.filter(i => ['DONE', 'SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus)).length;
                const progress = (doneCount / order.items.length) * 100;
                const isReady = pendingCount === 0 && order.items.every(i => ['DONE', 'SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));

                return (
                  <motion.div
                    key={order.id}
                    variants={cardVariants}
                    exit="exit"
                    layout
                    className={`relative bg-gradient-to-br ${urgency.bg} backdrop-blur-xl rounded-2xl border overflow-hidden ${
                      urgency.level === 'critical' ? 'border-red-500/30' : 
                      urgency.level === 'warning' ? 'border-amber-500/30' : 'border-slate-700/50'
                    }`}
                  >
                    {/* Urgency pulse for critical */}
                    {urgency.level === 'critical' && (
                      <motion.div 
                        className="absolute inset-0 bg-red-500/5 rounded-2xl"
                        variants={pulseVariants}
                        animate="pulse"
                      />
                    )}

                    {/* Card Header */}
                    <div className={`px-5 py-4 border-b ${
                      urgency.level === 'critical' ? 'border-red-500/20 bg-red-500/5' : 
                      urgency.level === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-700/30'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <motion.span 
                            className="text-5xl font-black text-white"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            T{order.table.tableNumber}
                          </motion.span>
                          <div>
                            <p className="text-xs text-slate-500">Order #{order.id}</p>
                            <p className={`text-sm font-bold ${
                              urgency.level === 'critical' ? 'text-red-400' : 
                              urgency.level === 'warning' ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                              {urgency.label} ago
                            </p>
                          </div>
                        </div>
                        
                        {/* Progress Ring */}
                        <div className="relative w-14 h-14">
                          <svg className="w-14 h-14 -rotate-90">
                            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" className="text-slate-700"/>
                            <motion.circle 
                              cx="28" cy="28" r="24" 
                              stroke={isReady ? '#10b981' : '#06b6d4'} 
                              strokeWidth="4" 
                              fill="none" 
                              strokeLinecap="round"
                              strokeDasharray={150.8}
                              initial={{ strokeDashoffset: 150.8 }}
                              animate={{ strokeDashoffset: 150.8 - (progress / 100) * 150.8 }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                            {Math.round(progress)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                      <AnimatePresence>
                        {order.items.map(item => {
                          const isDone = item.itemStatus === 'DONE';
                          const isSkipped = ['SKIPPED', 'OUT_OF_STOCK'].includes(item.itemStatus);
                          const isPending = item.itemStatus === 'PENDING';

                          return (
                            <motion.div
                              key={item.id}
                              variants={itemVariants}
                              exit="exit"
                              layout
                              className={`p-3 rounded-xl border transition-all ${
                                isDone ? 'bg-emerald-500/10 border-emerald-500/20' :
                                isSkipped ? 'bg-slate-800/30 border-slate-700/30 opacity-50' :
                                'bg-slate-800/50 border-slate-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
                                    isDone ? 'bg-emerald-500/20 text-emerald-400' :
                                    isSkipped ? 'bg-slate-700/50 text-slate-500' :
                                    'bg-orange-500/20 text-orange-400'
                                  }`}>
                                    {item.quantity}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-bold truncate ${isDone ? 'text-emerald-400 line-through' : isSkipped ? 'text-slate-500 line-through' : 'text-white'}`}>
                                      {item.menuItem.name}
                                    </p>
                                    {item.notes && (
                                      <p className="text-xs text-amber-400 truncate">📝 {item.notes}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                {!isDone && !isSkipped && (
                                  <div className="flex gap-1.5">
                                    <motion.button
                                      onClick={() => handleItemAction(item.id, 'DONE')}
                                      className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl flex items-center justify-center transition-colors"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                    >
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </motion.button>
                                    <motion.button
                                      onClick={() => handleItemAction(item.id, 'OOS')}
                                      className="w-10 h-10 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl flex items-center justify-center transition-colors"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                    >
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </motion.button>
                                  </div>
                                )}

                                {isDone && (
                                  <motion.div 
                                    className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 500 }}
                                  >
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>

                    {/* Footer - Deliver Button */}
                    {isReady && (
                      <motion.div 
                        className="p-4 border-t border-emerald-500/20 bg-emerald-500/5"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <motion.button
                          onClick={() => handleDeliver(order.id)}
                          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 transition-all"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Ready to Serve
                        </motion.button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default KitchenPanel;
