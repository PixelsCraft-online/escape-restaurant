import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSocket } from '../socket/useSocket';
import StatusBadge from '../components/StatusBadge';
import Timer from '../components/Timer';
import PremiumLogo from '../components/PremiumLogo';

const REQUEST_TIMEOUT_MS = 10000;

const TrackOrder = () => {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const navigate = useNavigate();

  // Session state
  const [sessionToken, setSessionToken] = useState(null);
  const [tableNumber, setTableNumber] = useState(null);
  const [tableId, setTableId] = useState(null);
  const [sessionValidating, setSessionValidating] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  const activeOrders = orders.filter(o => o.status !== 'BILLED');

  // Validate session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const storedToken = sessionStorage.getItem('tableToken');
        const storedTableId = sessionStorage.getItem('tableId');
        const storedTableNumber = sessionStorage.getItem('tableNumber');
        const tokenToValidate = urlToken || storedToken;

        if (tokenToValidate) {
          try {
            const res = await axios.get(`/api/session/validate/${tokenToValidate}`, {
              timeout: REQUEST_TIMEOUT_MS,
            });
            if (res.data.valid) {
              setSessionToken(tokenToValidate);
              setTableNumber(res.data.tableNumber);
              setTableId(res.data.tableId || (storedTableId ? parseInt(storedTableId) : null));
              sessionStorage.setItem('tableToken', tokenToValidate);
              sessionStorage.setItem('tableNumber', res.data.tableNumber);
              if (res.data.tableId) {
                sessionStorage.setItem('tableId', res.data.tableId);
              }
              
              if (!urlToken) {
                navigate(`/track?token=${tokenToValidate}`, { replace: true });
              }
              setSessionValidating(false);
              return;
            }

            // Token explicitly invalid.
            sessionStorage.removeItem('tableToken');
            sessionStorage.removeItem('tableNumber');
            sessionStorage.removeItem('tableId');
          } catch (validationErr) {
            console.error('Token validation request failed:', validationErr);

            // If network/timeout occurs but we still have stored context, continue with it
            // so users can still view active orders from the same table session.
            if (
              storedToken &&
              storedToken === tokenToValidate &&
              storedTableNumber &&
              storedTableId
            ) {
              setSessionToken(tokenToValidate);
              setTableNumber(parseInt(storedTableNumber));
              setTableId(parseInt(storedTableId));
              setSessionValidating(false);
              return;
            }
          }
        }

        // Try to create new session with stored table number
        if (storedTableNumber) {
          try {
            const res = await axios.post('/api/session/start', {
              tableNumber: parseInt(storedTableNumber)
            }, {
              timeout: REQUEST_TIMEOUT_MS,
            });
            
            setSessionToken(res.data.token);
            setTableNumber(res.data.tableNumber);
            setTableId(res.data.tableId);
            sessionStorage.setItem('tableToken', res.data.token);
            sessionStorage.setItem('tableNumber', res.data.tableNumber);
            sessionStorage.setItem('tableId', res.data.tableId);
            
            navigate(`/track?token=${res.data.token}`, { replace: true });
            setSessionValidating(false);
            return;
          } catch (startErr) {
            console.error('Failed to create new session:', startErr);
          }
        }

        // No way to recover
        sessionStorage.removeItem('tableToken');
        sessionStorage.removeItem('tableNumber');
        sessionStorage.removeItem('tableId');
        setSessionError('Your session has expired. Please scan the QR code again.');
      } catch (err) {
        console.error('Session validation failed:', err);
        setSessionError('Failed to validate session. Please scan the QR code again.');
      } finally {
        setSessionValidating(false);
      }
    };

    initSession();
  }, [urlToken, navigate]);

  // Configure axios to include token
  useEffect(() => {
    if (sessionToken) {
      axios.defaults.headers.common['x-table-token'] = sessionToken;
    }
    return () => {
      delete axios.defaults.headers.common['x-table-token'];
    };
  }, [sessionToken]);

  const socket = useSocket('join_table', { tableNumber });

  const fetchOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const [orderRes, billRes] = await Promise.all([
        axios.get(`/api/orders/table/${tableId}`),
        axios.get(`/api/bills/table/${tableId}`)
      ]);
      setOrders(orderRes.data);
      setBills(billRes.data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem('tableToken');
        sessionStorage.removeItem('tableNumber');
        setSessionError('Your session has expired. Please scan the QR code again.');
      }
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (tableId && !sessionValidating) fetchOrders();
  }, [tableId, sessionValidating, fetchOrders]);

  useEffect(() => {
    if (!tableId || sessionValidating || sessionError) return;
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [tableId, sessionValidating, sessionError, fetchOrders]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      fetchOrders();
    };

    socket.on('item_status_update', ({ orderItem }) => {
      setOrders(prev => prev.map(order => {
        if (order.id !== orderItem.orderId) return order;
        return {
          ...order,
          items: order.items.map(item => 
            item.id === orderItem.id ? orderItem : item
          )
        };
      }));
    });

    socket.on('order_completed', (completedOrder) => {
      setOrders(prev => prev.map(o => o.id === completedOrder.id ? completedOrder : o));
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => {
        const exists = prev.some(o => o.id === updatedOrder.id);
        if (exists) {
          return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        }
        return [updatedOrder, ...prev];
      });
    });

    socket.on('bill_generated', (bill) => {
      setBillRequested(false);
      // Add the new bill to the list
      setBills(prev => {
        const exists = prev.some(b => b.id === bill.id);
        if (exists) return prev;
        return [bill, ...prev];
      });
      // Refresh orders to update their status
      fetchOrders();
    });

    socket.on('bill_request_received', () => {
      setRequestingBill(false);
      setBillRequested(true);
    });

    socket.on('bill_paid', (bill) => {
      // Update the bill in the list
      setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
    });

    socket.on('session_ended', ({ message }) => {
      sessionStorage.removeItem('tableToken');
      sessionStorage.removeItem('tableNumber');
      sessionStorage.removeItem('tableId');
      setCallingWaiter(false);
      setWaiterCalled(false);
      setRequestingBill(false);
      setBillRequested(false);
      alert(message || 'Thank you for dining with us!');
      setSessionError('Your session has ended. Scan the QR code for a new visit!');
    });

    socket.on('waiter_call_received', () => {
      setCallingWaiter(false);
      setWaiterCalled(true);
    });

    socket.on('waiter_acknowledged', () => {
      setCallingWaiter(false);
      setWaiterCalled(false);
    });

    socket.on('connect', handleConnect);

    return () => {
      socket.off('item_status_update');
      socket.off('order_completed');
      socket.off('order_updated');
      socket.off('bill_generated');
      socket.off('bill_request_received');
      socket.off('bill_paid');
      socket.off('session_ended');
      socket.off('waiter_call_received');
      socket.off('waiter_acknowledged');
      socket.off('connect', handleConnect);
    };
  }, [socket, fetchOrders]);

  const callWaiter = async () => {
    if (!socket || !socket.connected || callingWaiter || waiterCalled || !tableId) return;
    setCallingWaiter(true);
    try {
      socket.emit('call_waiter', { tableId, tableNumber }, (ack) => {
        if (ack?.ok) {
          setWaiterCalled(true);
        } else {
          setWaiterCalled(false);
          alert(ack?.error || 'Failed to call waiter. Please try again.');
        }
        setCallingWaiter(false);
      });
    } catch (err) {
      console.error('Failed to call waiter:', err);
      setCallingWaiter(false);
    }
  };

  const requestBill = async () => {
    if (!socket || !socket.connected || requestingBill || billRequested || !tableId || activeOrders.length === 0) return;
    setRequestingBill(true);
    try {
      socket.emit('request_bill', { 
        tableId, 
        tableNumber,
        orderIds: activeOrders.map(o => o.id)
      }, (ack) => {
        if (ack?.ok) {
          setBillRequested(true);
        } else {
          setBillRequested(false);
          alert(ack?.error || 'Failed to request bill. Please try again.');
        }
        setRequestingBill(false);
      });
    } catch (err) {
      console.error('Failed to request bill:', err);
      setRequestingBill(false);
    }
  };

  // Session validating state
  if (sessionValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-500 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-zinc-400 text-sm tracking-wide">Validating session...</p>
        </div>
      </div>
    );
  }

  // Session error state
  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg text-white mb-2">Session Error</h2>
          <p className="text-sm text-zinc-400">{sessionError}</p>
        </div>
      </div>
    );
  }

  // Error state - No table
  if (!tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg text-white mb-2">No Table Found</h2>
          <p className="text-sm text-zinc-400">Please scan the QR code on your table to access the menu.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-500 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-zinc-400 text-sm tracking-wide">Loading orders...</p>
        </div>
      </div>
    );
  }

  const getProgress = () => {
    if (activeOrders.length === 0) return { step: 0, text: '', percent: 0 };

    const allItems = activeOrders.flatMap(o => o.items);
    const totalItems = allItems.length;
    if (totalItems === 0) return { step: 1, text: 'Order received', percent: 33 };

    const terminalStatuses = ['DONE', 'SKIPPED', 'OUT_OF_STOCK'];
    const doneItems = allItems.filter(i => i.itemStatus === 'DONE').length;
    const finishedItems = allItems.filter(i => terminalStatuses.includes(i.itemStatus)).length;
    const preparingItems = allItems.filter(i => i.itemStatus === 'PREPARING').length;
    const hasActivePreparation = activeOrders.some(o => ['IN_PROGRESS', 'PARTIALLY_READY', 'COMPLETED'].includes(o.status));
    
    if (finishedItems === totalItems) {
      return { step: 3, text: 'Ready to serve', percent: 100 };
    }

    if (preparingItems > 0 || finishedItems > 0 || hasActivePreparation) {
      const progressPercent = Math.max(33, Math.min(95, Math.round((finishedItems / totalItems) * 100)));
      return { step: 2, text: `Preparing (${doneItems}/${totalItems} ready)`, percent: progressPercent };
    }

    return { step: 1, text: 'Order received', percent: 33 };
  };

  const progress = getProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black pb-28">
      {/* Premium Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-orange-800/20 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 px-5 py-5 flex justify-between items-center">
          <PremiumLogo size="small" />
          <button 
            onClick={() => navigate(`/menu?token=${sessionToken}`)}
            className="h-11 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold rounded-xl flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Order More
          </button>
        </div>
        
        {/* Table Info */}
        <div className="relative z-10 px-5 pb-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center border border-zinc-600">
              <span className="text-lg font-bold text-white">{tableNumber}</span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Table</p>
              <p className="text-white font-medium text-sm">Order Tracking</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Section - Premium Glass Style */}
      {activeOrders.length > 0 && (
        <div className="mx-5 mt-2 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          {/* ETA Section */}
          <div className="p-5 border-b border-white/[0.06]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Estimated Time</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">15-20</span>
                  <span className="text-sm text-zinc-500">mins</span>
                </div>
              </div>
              <Timer startTime={activeOrders[0].createdAt} mode="customer" />
            </div>
            
            {/* Progress Bar */}
            <div className="mt-5">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                ></div>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{progress.text}</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="p-5 flex justify-between">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                progress.step >= 1 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25' 
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {progress.step >= 1 ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-bold">1</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 text-center font-medium">Received</span>
            </div>
            <div className="flex-1 flex items-center px-3">
              <div className={`h-0.5 w-full rounded ${progress.step >= 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-800'}`}></div>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                progress.step >= 2 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25' 
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {progress.step >= 2 ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-bold">2</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 text-center font-medium">Preparing</span>
            </div>
            <div className="flex-1 flex items-center px-3">
              <div className={`h-0.5 w-full rounded ${progress.step >= 3 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-800'}`}></div>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                progress.step >= 3 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25' 
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {progress.step >= 3 ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-bold">3</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 text-center font-medium">Ready</span>
            </div>
          </div>
        </div>
      )}

      <main className="px-5 mt-4 space-y-4">
        {activeOrders.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-10 text-center mt-6">
            <div className="w-20 h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Active Orders</h2>
            <p className="text-sm text-zinc-500 mb-6">Start ordering from our premium menu</p>
            <button 
              onClick={() => navigate(`/menu?token=${sessionToken}`)}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            {activeOrders.map((order, idx) => (
              <div key={order.id} className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
                {/* Order Header */}
                <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Order #{order.id}</span>
                      {idx === 0 && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                          LATEST
                        </span>
                      )}
                    </div>
                    <StatusBadge status={order.status} type="order" />
                  </div>
                </div>
                
                {/* Order Items */}
                <div className="divide-y divide-white/[0.04]">
                  {order.items.map(item => (
                    <div key={item.id} className="px-5 py-4 flex gap-3">
                      <div className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center mt-0.5 ${item.menuItem?.isVeg ? 'border-emerald-500' : 'border-red-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${item.menuItem?.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className={`text-sm font-medium ${
                            item.itemStatus === 'OUT_OF_STOCK' || item.itemStatus === 'SKIPPED' 
                              ? 'text-zinc-600 line-through' 
                              : 'text-white'
                          }`}>
                            {item.menuItem?.name}
                          </p>
                          {/* Only show item status when it's actively being prepared or ready, not pending */}
                          {item.itemStatus !== 'PENDING' && (
                            <StatusBadge status={item.itemStatus} type="item" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{item.quantity} x ₹{item.price}</p>
                        {item.instructions && (
                          <p className="text-xs text-amber-500/70 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            {item.instructions}
                          </p>
                        )}
                        {(item.itemStatus === 'OUT_OF_STOCK' || item.itemStatus === 'SKIPPED') && (
                          <p className="text-xs text-red-400 mt-1">Not available - Won't be charged</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add More Button */}
                {idx === 0 && order.status !== 'COMPLETED' && (
                  <div className="px-5 py-4 border-t border-white/[0.06]">
                    <button 
                      onClick={() => navigate(`/menu?token=${sessionToken}&order=${order.id}`)}
                      className="text-sm text-amber-400 font-medium flex items-center gap-1.5 hover:text-amber-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add more items
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Generated Bills Section */}
        {bills.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent"></div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Your Bill</h3>
              <div className="h-px flex-1 bg-gradient-to-l from-zinc-800 to-transparent"></div>
            </div>
            
            {bills.filter(b => !b.isPaid).map(bill => (
              <div key={bill.id} className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
                {/* Bill Header */}
                <div className="px-5 py-4 bg-white/[0.02] border-b border-white/[0.06] flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-white">Bill #{bill.id}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(bill.createdAt).toLocaleString('en-IN', { 
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    bill.isPaid 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {bill.isPaid ? 'PAID' : 'PENDING'}
                  </span>
                </div>

                {/* Bill Items */}
                {bill.order?.items && (
                  <div className="divide-y divide-white/[0.04]">
                    {bill.order.items.filter(item => 
                      item.itemStatus !== 'OUT_OF_STOCK' && item.itemStatus !== 'SKIPPED'
                    ).map(item => (
                      <div key={item.id} className="px-5 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center ${item.menuItem?.isVeg ? 'border-emerald-500' : 'border-red-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${item.menuItem?.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          </div>
                          <span className="text-sm text-zinc-300">{item.menuItem?.name}</span>
                          <span className="text-xs text-zinc-600">x{item.quantity}</span>
                        </div>
                        <span className="text-sm text-white font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bill Summary */}
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.06] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="text-zinc-300">₹{bill.subtotal?.toFixed(0)}</span>
                  </div>
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-400">Discount</span>
                      <span className="text-emerald-400">-₹{bill.discount?.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Tax (5%)</span>
                    <span className="text-zinc-300">₹{bill.tax?.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-white/[0.06]">
                    <span className="text-white">Total</span>
                    <span className="bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">₹{bill.total?.toFixed(0)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                {!bill.isPaid && (
                  <div className="px-5 py-4 bg-amber-500/10 border-t border-amber-500/20">
                    <p className="text-sm text-amber-400 text-center font-medium">
                      Please pay at the counter
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Action Bar - Premium Glass */}
      {activeOrders.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <div className="p-3 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex gap-3">
              <button 
                onClick={callWaiter}
                disabled={callingWaiter || waiterCalled}
                className={`flex-1 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
                  waiterCalled 
                    ? 'bg-emerald-500 text-black' 
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {waiterCalled ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Notified
                  </>
                ) : (
                  <>{callingWaiter ? 'Calling...' : 'Call Waiter'}</>
                )}
              </button>
              <button 
                onClick={requestBill}
                disabled={requestingBill || billRequested}
                className={`flex-1 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm ${
                  billRequested 
                    ? 'bg-emerald-500 text-black' 
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/25'
                }`}
              >
                {billRequested ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Requested
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {requestingBill ? 'Requesting...' : 'Request Bill'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Developer Credit */}
      <footer className={`mt-10 ${activeOrders.length > 0 ? 'pb-24' : 'pb-6'} px-5`}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-6 h-px bg-zinc-700"></span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Powered by</span>
            <span className="w-6 h-px bg-zinc-700"></span>
          </div>
          <a 
            href="https://pixelscraft.online" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-semibold text-zinc-400 hover:text-amber-400 transition-colors"
          >
            PixelsCraft.online
          </a>
          <p className="text-[11px] text-zinc-600 mt-1">
            <a href="tel:+919391279070" className="hover:text-amber-400 transition-colors">
              +91 93912 79070
            </a>
          </p>
        </div>
      </footer>

      <style>{`
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default TrackOrder;
