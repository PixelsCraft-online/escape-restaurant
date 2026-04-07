import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../socket/useSocket';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } }
};

const slideVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { opacity: 0, x: 50, transition: { duration: 0.15 } }
};

const CounterPanel = () => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [discount, setDiscount] = useState({ amount: '', type: 'flat' });
  const [includeGST, setIncludeGST] = useState(false);
  const [billRequests, setBillRequests] = useState([]);
  const [settledOrders, setSettledOrders] = useState({}); // Track settled orders { orderId: true }
  const [printingBill, setPrintingBill] = useState(null); // Order being printed
  const [processingBill, setProcessingBill] = useState(false);

  const socket = useSocket(isAuthenticated ? 'join_staff' : null, { pin });

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === 'escape2024') setIsAuthenticated(true);
    else alert('Invalid PIN');
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOrders();
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/orders', { headers: { 'x-admin-pin': pin } });
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401) setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    
    socket.on('new_order', (order) => setOrders(prev => [...prev, order]));
    socket.on('order_updated', (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      if (selectedOrder?.id === order.id) setSelectedOrder(order);
    });
    socket.on('item_status_update', ({ orderItem }) => {
      setOrders(prev => prev.map(order => {
        if (order.id !== orderItem.orderId) return order;
        const updated = { ...order, items: order.items.map(i => i.id === orderItem.id ? orderItem : i) };
        if (selectedOrder?.id === order.id) setSelectedOrder(updated);
        return updated;
      }));
    });
    socket.on('order_completed', (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      if (selectedOrder?.id === order.id) setSelectedOrder(order);
    });
    socket.on('bill_generated', (bill) => {
      setBillRequests(prev => prev.filter(r => !r.orderIds?.includes(bill.orderId)));
    });
    socket.on('bill_requested', (req) => {
      setBillRequests(prev => prev.some(r => r.tableNumber === req.tableNumber) ? prev : [...prev, req]);
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('item_status_update');
      socket.off('order_completed');
      socket.off('bill_generated');
      socket.off('bill_requested');
    };
  }, [socket, selectedOrder]);

  // Settle Bill - Mark as paid and restart table session
  const handleSettleBill = async (order) => {
    setProcessingBill(true);
    try {
      // Calculate totals
      const chargeableItems = order.items.filter(i => !['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));
      const subtotal = chargeableItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const discountAmt = discount.type === 'percent' 
        ? (subtotal * (parseFloat(discount.amount) || 0) / 100) 
        : (parseFloat(discount.amount) || 0);
      const taxable = Math.max(0, subtotal - discountAmt);
      const gst = includeGST ? taxable * 0.05 : 0;
      
      // Generate bill and mark paid
      const billRes = await axios.post('/api/bills', { 
        orderId: order.id, 
        discount: discountAmt, 
        discountType: 'flat',
        gst: gst
      }, { headers: { 'x-admin-pin': pin } });
      
      await axios.patch(`/api/bills/${billRes.data.id}/pay`, {}, { headers: { 'x-admin-pin': pin } });
      
      // Reset table session - use table.id (from included relation)
      const tableId = order.tableId || order.table?.id;
      if (tableId) {
        await axios.post(`/api/admin/tables/${tableId}/reset`, {}, { headers: { 'x-admin-pin': pin } });
      }
      
      // Mark as settled
      setSettledOrders(prev => ({ ...prev, [order.id]: true }));
      
    } catch (err) {
      console.error('Settle bill error:', err);
      alert('Failed to settle bill: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessingBill(false);
    }
  };

  // Print Bill and remove from list
  const handlePrintBill = (order) => {
    setPrintingBill(order);
    
    // Create print content
    const chargeableItems = order.items.filter(i => !['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));
    const subtotal = chargeableItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const discountAmt = discount.type === 'percent' 
      ? (subtotal * (parseFloat(discount.amount) || 0) / 100) 
      : (parseFloat(discount.amount) || 0);
    const taxable = Math.max(0, subtotal - discountAmt);
    const gst = includeGST ? taxable * 0.05 : 0;
    const total = taxable + gst;

    const printContent = `
      <html>
        <head>
          <title>Bill - Table ${order.table.tableNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; font-size: 12px; }
            .items { margin: 15px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ESCAPE</h1>
            <p>Restaurant & Cafe</p>
            <p>Table: ${order.table.tableNumber}</p>
            <p>${new Date().toLocaleString('en-IN')}</p>
          </div>
          <div class="items">
            ${chargeableItems.map(item => `
              <div class="item">
                <span>${item.quantity}x ${item.menuItem.name}</span>
                <span>₹${(item.price * item.quantity).toFixed(0)}</span>
              </div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="item"><span>Subtotal</span><span>₹${subtotal.toFixed(0)}</span></div>
          ${discountAmt > 0 ? `<div class="item"><span>Discount</span><span>-₹${discountAmt.toFixed(0)}</span></div>` : ''}
          ${gst > 0 ? `<div class="item"><span>GST (5%)</span><span>₹${gst.toFixed(0)}</span></div>` : ''}
          <div class="divider"></div>
          <div class="total"><span>TOTAL</span><span>₹${total.toFixed(0)}</span></div>
          <div class="footer">
            <p>Thank you for dining with us!</p>
            <p>Visit again</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();

    // Remove from orders list after print
    setTimeout(() => {
      setOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedOrder(null);
      setSettledOrders(prev => {
        const newState = { ...prev };
        delete newState[order.id];
        return newState;
      });
      setPrintingBill(null);
    }, 500);
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl"
            animate={{ scale: [1.3, 1, 1.3], opacity: [0.5, 0.3, 0.5] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
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
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Counter</h1>
            <p className="text-slate-400 mt-2 text-lg">Enter PIN to access billing</p>
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
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl mb-6 text-center tracking-[0.5em] font-mono text-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-white placeholder-slate-600 transition-all"
              autoFocus
            />
          </motion.div>
          
          <motion.button 
            type="submit" 
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 py-5 rounded-2xl font-bold text-white text-xl transition-all shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Enter Counter
          </motion.button>
        </motion.form>
      </div>
    );
  }

  const activeOrders = orders.filter(o => !['BILLED'].includes(o.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <motion.header 
        className="bg-slate-900/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4 sticky top-0 z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center max-w-[1920px] mx-auto">
          <div className="flex items-center gap-5">
            <motion.div 
              className="w-14 h-14 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
              whileHover={{ scale: 1.05, rotate: -5 }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75" />
              </svg>
            </motion.div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Counter Panel</h1>
              <p className="text-sm text-slate-500">Escape Restaurant</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-cyan-400 font-bold">{activeOrders.length}</span>
              <span className="text-cyan-400/70 text-sm">Active Orders</span>
            </div>
          </div>

          {/* Clock */}
          <div className="text-right">
            <p className="text-3xl font-black text-white font-mono tracking-tight">
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </motion.header>

      {/* Bill Requests Banner */}
      <AnimatePresence>
        {billRequests.length > 0 && (
          <motion.div 
            className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-b border-amber-500/20 px-6 py-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-4 max-w-[1920px] mx-auto">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <motion.span 
                  className="w-3 h-3 rounded-full bg-amber-400"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                Bill Requests
              </div>
              <div className="flex gap-2 flex-wrap">
                {billRequests.map((req, idx) => (
                  <motion.div 
                    key={idx} 
                    className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 px-4 py-2 rounded-xl"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <span className="text-amber-300 font-bold">Table {req.tableNumber}</span>
                    <motion.button 
                      type="button"
                      onClick={() => {
                        const tableOrders = orders.filter(o => o.table?.tableNumber === req.tableNumber);
                        if (tableOrders.length > 0) {
                          setSelectedOrder(tableOrders[0]);
                        }
                        setBillRequests(prev => prev.filter(r => r.tableNumber !== req.tableNumber));
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3 py-1 rounded-lg text-sm transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Select
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-6 flex gap-6 max-w-[1920px] mx-auto w-full overflow-hidden">
        {/* Orders Table */}
        <div className="flex-1 bg-slate-800/30 backdrop-blur-sm rounded-3xl border border-slate-700/30 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <motion.div 
                className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Table</th>
                    <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Order</th>
                    <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="p-5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Progress</th>
                    <th className="p-5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="p-5 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <motion.tbody 
                  className="divide-y divide-slate-700/20"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {activeOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-16 text-center">
                          <motion.div 
                            className="flex flex-col items-center text-slate-500"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                              </svg>
                            </div>
                            <p className="text-lg font-semibold">No active orders</p>
                          </motion.div>
                        </td>
                      </tr>
                    ) : (
                      activeOrders.map(order => {
                        const chargeableItems = order.items.filter(i => !['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));
                        const total = chargeableItems.reduce((s, i) => s + i.price * i.quantity, 0);
                        const doneCount = order.items.filter(i => ['DONE', 'SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus)).length;
                        const progress = Math.round((doneCount / order.items.length) * 100);
                        const isReady = order.status === 'COMPLETED';
                        const isSelected = selectedOrder?.id === order.id;
                        const isSettled = settledOrders[order.id];

                        return (
                          <motion.tr 
                            key={order.id} 
                            variants={rowVariants}
                            exit="exit"
                            layout
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/30'
                            }`}
                            onClick={() => !isSettled && setSelectedOrder(order)}
                          >
                            <td className="p-5">
                              <span className="text-4xl font-black text-white">T{order.table.tableNumber}</span>
                            </td>
                            <td className="p-5 text-slate-400 font-mono">#{order.id}</td>
                            <td className="p-5">
                              {isSettled ? (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  ✓ SETTLED
                                </span>
                              ) : (
                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                  isReady 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                    : order.status === 'IN_PROGRESS'
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}>
                                  {isReady ? '✓ READY' : order.status.replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-3">
                                <div className="w-28 h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                  <motion.div 
                                    className={`h-full ${isSettled || isReady ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-slate-400">{progress}%</span>
                              </div>
                            </td>
                            <td className="p-5 text-right">
                              <span className="text-2xl font-black text-white">₹{total.toFixed(0)}</span>
                            </td>
                            <td className="p-5 text-center">
                              {isSettled ? (
                                <motion.button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrintBill(order); }}
                                  className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-500/20"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  🖨️ Print Bill
                                </motion.button>
                              ) : (
                                <motion.button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedOrder(order); }}
                                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                                    isSelected 
                                      ? 'bg-emerald-500 text-white' 
                                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                  }`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  {isSelected ? 'Selected' : 'Settle Bill'}
                                </motion.button>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          )}
        </div>

        {/* Billing Panel */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={selectedOrder?.id || 'empty'}
            className="w-[420px] bg-slate-800/30 backdrop-blur-sm rounded-3xl border border-slate-700/30 flex flex-col overflow-hidden"
            variants={slideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {selectedOrder ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-700/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Generate Bill</p>
                      <motion.h2 
                        className="text-5xl font-black text-white mt-1"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        Table {selectedOrder.table.tableNumber}
                      </motion.h2>
                    </div>
                    <motion.button 
                      onClick={() => setSelectedOrder(null)} 
                      className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors text-slate-400 hover:text-white"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </motion.button>
                  </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-auto p-6 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Order Items</p>
                  <motion.div 
                    className="space-y-2"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {selectedOrder.items.filter(i => !['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus)).map(item => (
                      <motion.div 
                        key={item.id} 
                        className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700/30"
                        variants={rowVariants}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-bold">
                            {item.quantity}
                          </span>
                          <span className="text-white font-medium">{item.menuItem.name}</span>
                        </div>
                        <span className="font-bold text-white">₹{(item.price * item.quantity).toFixed(0)}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                  
                  {selectedOrder.items.filter(i => ['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus)).length > 0 && (
                    <div className="pt-4 mt-4 border-t border-slate-700/30">
                      <p className="text-xs font-bold text-red-400/70 uppercase tracking-wider mb-3">Not Charged</p>
                      {selectedOrder.items.filter(i => ['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus)).map(item => (
                        <div key={item.id} className="flex justify-between items-center py-2 text-slate-500 line-through text-sm">
                          <span>{item.quantity}x {item.menuItem.name}</span>
                          <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bill Calculation */}
                <div className="p-6 border-t border-slate-700/30 bg-slate-900/50 space-y-5">
                  {/* Discount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Discount</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        min="0"
                        value={discount.amount}
                        onChange={(e) => setDiscount(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                        disabled={settledOrders[selectedOrder.id]}
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-mono text-lg disabled:opacity-50"
                      />
                      <select 
                        value={discount.type}
                        onChange={(e) => setDiscount(prev => ({ ...prev, type: e.target.value }))}
                        disabled={settledOrders[selectedOrder.id]}
                        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer font-bold disabled:opacity-50"
                      >
                        <option value="flat">₹</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* GST Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        className={`w-12 h-7 rounded-full relative transition-colors ${
                          includeGST ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                        onClick={() => !settledOrders[selectedOrder.id] && setIncludeGST(!includeGST)}
                      >
                        <motion.div 
                          className="w-5 h-5 bg-white rounded-full absolute top-1 shadow-md"
                          animate={{ left: includeGST ? '26px' : '4px' }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                        Include GST (5%)
                      </span>
                    </label>
                  </div>

                  {/* Summary */}
                  {(() => {
                    const chargeableItems = selectedOrder.items.filter(i => !['SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));
                    const subtotal = chargeableItems.reduce((s, i) => s + i.price * i.quantity, 0);
                    const discountAmt = discount.type === 'percent' 
                      ? (subtotal * (parseFloat(discount.amount) || 0) / 100) 
                      : (parseFloat(discount.amount) || 0);
                    const taxable = Math.max(0, subtotal - discountAmt);
                    const tax = includeGST ? taxable * 0.05 : 0;
                    const total = taxable + tax;

                    return (
                      <motion.div 
                        className="bg-slate-800/50 rounded-2xl p-5 space-y-3 border border-slate-700/30"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Subtotal ({chargeableItems.length} items)</span>
                          <span className="font-mono">₹{subtotal.toFixed(0)}</span>
                        </div>
                        {discountAmt > 0 && (
                          <motion.div 
                            className="flex justify-between text-sm text-emerald-400"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                          >
                            <span>Discount</span>
                            <span className="font-mono">-₹{discountAmt.toFixed(0)}</span>
                          </motion.div>
                        )}
                        {includeGST && (
                          <div className="flex justify-between text-sm text-slate-400">
                            <span>GST (5%)</span>
                            <span className="font-mono">₹{tax.toFixed(0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-2xl font-black text-white pt-3 border-t border-slate-700/50">
                          <span>Total</span>
                          <motion.span 
                            className="text-emerald-400 font-mono"
                            key={total}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                          >
                            ₹{total.toFixed(0)}
                          </motion.span>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex gap-3">
                    {/* Settle Bill / Settled */}
                    <motion.button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSettleBill(selectedOrder); }}
                      disabled={processingBill || settledOrders[selectedOrder.id]}
                      className={`flex-1 py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 ${
                        settledOrders[selectedOrder.id]
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-white shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40'
                      } disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none`}
                      whileHover={processingBill || settledOrders[selectedOrder.id] ? {} : { scale: 1.02 }}
                      whileTap={processingBill || settledOrders[selectedOrder.id] ? {} : { scale: 0.98 }}
                    >
                      {processingBill ? (
                        <motion.div 
                          className="w-6 h-6 border-3 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                      ) : settledOrders[selectedOrder.id] ? (
                        <>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Settled
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                          Settle Bill
                        </>
                      )}
                    </motion.button>

                    {/* Print Bill - only show after settled */}
                    {settledOrders[selectedOrder.id] && (
                      <motion.button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrintBill(selectedOrder); }}
                        className="flex-1 py-5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-2xl font-black text-xl transition-all shadow-2xl shadow-violet-500/25 hover:shadow-violet-500/40 flex items-center justify-center gap-3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                      </motion.button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
                <motion.div 
                  className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </motion.div>
                <p className="text-xl font-bold text-slate-400">Select an order</p>
                <p className="text-sm text-slate-600 mt-2 text-center">Click on an order from the table to generate bill</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CounterPanel;
