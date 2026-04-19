import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../socket/useSocket';

const COLORS = ['#f97316', '#0ea5e9', '#22c55e', '#8b5cf6', '#f43f5e', '#eab308'];
const CATEGORIES = ['STARTER', 'MAIN_VEG', 'MAIN_NONVEG', 'BREAD_RICE', 'DESSERT', 'BEVERAGE'];
const REQUEST_TIMEOUT_MS = 10000;

const AdminDashboard = () => {
  // Auth
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard data
  const [data, setData] = useState(null);
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  
  // Menu Management
  const [menuItems, setMenuItems] = useState([]);
  const [menuFilter, setMenuFilter] = useState('ALL');
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Table Management
  const [tables, setTables] = useState([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [showQRModal, setShowQRModal] = useState(null);
  
  // Order History
  const [orders, setOrders] = useState([]);
  const [orderFilters, setOrderFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'ALL',
    tableNumber: '',
    search: ''
  });
  const [orderPagination, setOrderPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Date Range Analytics
  const [rangeAnalytics, setRangeAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN;
  const authHeaders = { 'x-admin-pin': ADMIN_PIN };
  const socket = useSocket(isAuthenticated ? 'join_admin' : null, { pin: ADMIN_PIN });

  // Auth
  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid PIN');
    }
  };

  // Fetch Dashboard Data
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError('');
    try {
      const [analyticsRes, weekRes] = await Promise.all([
        axios.get('/api/admin/analytics', { headers: authHeaders, timeout: REQUEST_TIMEOUT_MS }),
        axios.get('/api/admin/analytics/week', { headers: authHeaders, timeout: REQUEST_TIMEOUT_MS })
      ]);
      setData(analyticsRes.data);
      setWeekData(weekRes.data.reverse());
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) setIsAuthenticated(false);
      const message = err.response?.status === 429
        ? 'Too many requests. Please wait a few seconds and try again.'
        : 'Failed to load dashboard data. Please retry.';
      setDashboardError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Menu
  const fetchMenu = useCallback(async () => {
    try {
      const res = await axios.get('/api/menu', { timeout: REQUEST_TIMEOUT_MS });
      setMenuItems(res.data.items);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Tables
  const fetchTables = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/tables', { headers: authHeaders, timeout: REQUEST_TIMEOUT_MS });
      setTables(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Orders
  const fetchOrders = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (orderFilters.startDate) params.append('startDate', orderFilters.startDate);
      if (orderFilters.endDate) params.append('endDate', orderFilters.endDate);
      if (orderFilters.status !== 'ALL') params.append('status', orderFilters.status);
      if (orderFilters.tableNumber) params.append('tableNumber', orderFilters.tableNumber);
      if (orderFilters.search) params.append('search', orderFilters.search);

      const res = await axios.get(`/api/admin/orders?${params}`, { headers: authHeaders, timeout: REQUEST_TIMEOUT_MS });
      setOrders(res.data.orders);
      setOrderPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, [orderFilters]);

  // Fetch Range Analytics
  const fetchRangeAnalytics = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    try {
      const res = await axios.get(`/api/admin/analytics/range?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers: authHeaders, timeout: REQUEST_TIMEOUT_MS });
      setRangeAnalytics(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [dateRange]);

  // Initial load based on tab
  useEffect(() => {
    if (!isAuthenticated) return;
    
    if (activeTab === 'dashboard') {
      fetchDashboard();
      fetchMenu();
    } else if (activeTab === 'menu') {
      fetchMenu();
    } else if (activeTab === 'tables') {
      fetchTables();
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'analytics') {
      fetchRangeAnalytics();
    }
  }, [isAuthenticated, activeTab, fetchDashboard, fetchMenu, fetchTables, fetchOrders, fetchRangeAnalytics]);

  // Auto-refresh active admin tab so updates from any table remain visible.
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (activeTab === 'dashboard') {
        fetchDashboard();
      } else if (activeTab === 'tables') {
        fetchTables();
      } else if (activeTab === 'orders') {
        fetchOrders(orderPagination.page || 1);
      } else if (activeTab === 'analytics') {
        fetchRangeAnalytics();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    activeTab,
    fetchDashboard,
    fetchTables,
    fetchOrders,
    fetchRangeAnalytics,
    orderPagination.page,
  ]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const refreshCurrentTab = () => {
      if (activeTab === 'dashboard') {
        fetchDashboard();
        fetchTables();
      } else if (activeTab === 'menu') {
        fetchMenu();
      } else if (activeTab === 'tables') {
        fetchTables();
      } else if (activeTab === 'orders') {
        fetchOrders(orderPagination.page || 1);
      } else if (activeTab === 'analytics') {
        fetchRangeAnalytics();
        fetchTables();
      }
    };

    const onOrderEvent = () => refreshCurrentTab();
    const onBillEvent = () => refreshCurrentTab();
    const onMenuEvent = () => {
      if (activeTab === 'menu' || activeTab === 'dashboard') {
        fetchMenu();
      }
    };

    socket.on('new_order', onOrderEvent);
    socket.on('order_updated', onOrderEvent);
    socket.on('order_completed', onOrderEvent);
    socket.on('bill_generated', onBillEvent);
    socket.on('bill_paid', onBillEvent);
    socket.on('menu_item_toggled', onMenuEvent);

    return () => {
      socket.off('new_order', onOrderEvent);
      socket.off('order_updated', onOrderEvent);
      socket.off('order_completed', onOrderEvent);
      socket.off('bill_generated', onBillEvent);
      socket.off('bill_paid', onBillEvent);
      socket.off('menu_item_toggled', onMenuEvent);
    };
  }, [
    socket,
    isAuthenticated,
    activeTab,
    fetchDashboard,
    fetchMenu,
    fetchTables,
    fetchOrders,
    fetchRangeAnalytics,
    orderPagination.page,
  ]);

  // Menu Actions
  const toggleMenuItem = async (id, currentStatus) => {
    try {
      await axios.patch(`/api/admin/menu/${id}`, { isAvailable: !currentStatus }, { headers: authHeaders });
      setMenuItems(prev => prev.map(item => item.id === id ? { ...item, isAvailable: !currentStatus } : item));
    } catch (err) {
      alert('Failed to toggle item');
    }
  };

  const saveMenuItem = async (formData) => {
    try {
      if (editingItem) {
        await axios.put(`/api/admin/menu/${editingItem.id}`, formData, { headers: authHeaders });
      } else {
        await axios.post('/api/admin/menu', formData, { headers: authHeaders });
      }
      fetchMenu();
      setShowMenuModal(false);
      setEditingItem(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save item');
    }
  };

  const deleteMenuItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await axios.delete(`/api/admin/menu/${id}`, { headers: authHeaders });
      alert(res.data.message);
      fetchMenu();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // Table Actions
  const saveTable = async (tableNumber) => {
    try {
      if (editingTable) {
        await axios.put(`/api/admin/tables/${editingTable.id}`, { tableNumber }, { headers: authHeaders });
      } else {
        await axios.post('/api/admin/tables', { tableNumber }, { headers: authHeaders });
      }
      fetchTables();
      setShowTableModal(false);
      setEditingTable(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save table');
    }
  };

  const deleteTable = async (id) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      await axios.delete(`/api/admin/tables/${id}`, { headers: authHeaders });
      fetchTables();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete table');
    }
  };

  const resetTable = async (id) => {
    if (!confirm('Reset this table? This will end any active session.')) return;
    try {
      await axios.post(`/api/admin/tables/${id}/reset`, {}, { headers: authHeaders });
      fetchTables();
    } catch (err) {
      alert('Failed to reset table');
    }
  };

  // Export
  const downloadReport = (isRange = false) => {
    if (isRange) {
      window.location.href = `/api/admin/export/range?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&pin=${ADMIN_PIN}`;
    } else {
      window.location.href = `/api/admin/export?pin=${ADMIN_PIN}`;
    }
  };

  // Filter menu items
  const filteredMenu = menuItems.filter(item => {
    if (menuFilter !== 'ALL' && item.category !== menuFilter) return false;
    if (menuSearch && !item.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    return true;
  });

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-white/20">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
            <p className="text-sm text-gray-400 mt-1">Escape Restaurant</p>
          </div>
          <input 
            type="password" 
            placeholder="Enter Admin PIN" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-4 bg-white/10 border border-white/20 rounded-xl mb-4 text-center tracking-widest font-mono text-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            autoFocus
          />
          <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
            Login
          </button>
        </form>
      </div>
    );
  }

  // Navigation Tabs
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'menu', label: 'Menu', icon: '🍽️' },
    { id: 'tables', label: 'Tables', icon: '🪑' },
    { id: 'orders', label: 'Orders', icon: '📋' },
    { id: 'analytics', label: 'Reports', icon: '📈' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Escape Restaurant</p>
            </div>
          </div>
          <button 
            onClick={() => { setIsAuthenticated(false); setPin(''); }}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-medium text-sm"
          >
            Logout
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : dashboardError ? (
              <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600 font-medium">{dashboardError}</p>
                <button
                  onClick={fetchDashboard}
                  className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                >
                  Retry
                </button>
              </div>
            ) : !data ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                <p className="text-gray-600 font-medium">No dashboard data available.</p>
                <button
                  onClick={fetchDashboard}
                  className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Today's Revenue" value={`₹${data.totalRevenue.toLocaleString('en-IN')}`} color="orange" />
                  <KPICard title="Total Orders" value={data.totalOrders} color="blue" />
                  <KPICard title="Avg. Order Value" value={`₹${(data.avgOrderValue ?? 0).toFixed(0)}`} color="green" />
                  <KPICard title="Tables Occupied" value={`${data.tablesOccupied}/${data.totalTables}`} color="purple" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Pie Chart */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue by Category</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data.categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            {data.categoryData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip formatter={(v) => `₹${v}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Line Chart */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">7-Day Revenue Trend</h3>
                      <button onClick={() => downloadReport()} className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        Export Today's CSV
                      </button>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weekData}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(v) => `₹${v}`} />
                          <RechartsTooltip formatter={(v) => `₹${v}`} />
                          <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#colorRevenue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Top Items & Table Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Today's Top 10 Items</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                            <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                            <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.topItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-900">{item.name}</td>
                              <td className="p-3 text-gray-500">{item.category}</td>
                              <td className="p-3 text-right font-medium">{item.count}</td>
                              <td className="p-3 text-right font-bold text-gray-900">₹{item.revenue}</td>
                            </tr>
                          ))}
                          {data.topItems.length === 0 && (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">No orders today yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Table Status</h3>
                      <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Free</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Busy</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {data.tables.map(t => (
                        <div key={t.id} className={`aspect-square rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                          t.isOccupied ? 'bg-red-50 border-red-400 text-red-700' : 'bg-green-50 border-green-400 text-green-700'
                        }`}>
                          {t.tableNumber}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* MENU TAB */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
                <select
                  value={menuFilter}
                  onChange={(e) => setMenuFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <button
                onClick={() => { setEditingItem(null); setShowMenuModal(true); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            </div>

            {/* Menu Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Price</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="p-4 text-center text-xs font-semibold text-gray-500 uppercase">Available</th>
                      <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMenu.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {item.imageUrl && <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.isSpecial && <span className="text-xs text-orange-600 font-medium">⭐ Special</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-500">{item.category.replace('_', ' ')}</td>
                        <td className="p-4 font-medium">₹{item.price}</td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${item.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.isVeg ? 'Veg' : 'Non-Veg'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleMenuItem(item.id, item.isAvailable)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                          >
                            <span className={`${item.isAvailable ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingItem(item); setShowMenuModal(true); }}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteMenuItem(item.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TABLES TAB */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900">Table Management</h2>
                <p className="text-sm text-gray-500">Manage restaurant tables and generate QR codes</p>
              </div>
              <button
                onClick={() => { setEditingTable(null); setShowTableModal(true); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Table
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tables.map(table => (
                <div key={table.id} className={`bg-white rounded-xl shadow-sm border-2 p-4 transition ${
                  table.isOccupied ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className={`text-2xl font-bold ${table.isOccupied ? 'text-red-600' : 'text-gray-900'}`}>
                      T{table.tableNumber}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      table.isOccupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {table.isOccupied ? 'Occupied' : 'Free'}
                    </span>
                  </div>
                  
                  {table.activeSession && (
                    <p className="text-xs text-gray-500 mb-3">
                      Session: {new Date(table.activeSession.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setShowQRModal(table)}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                    >
                      QR Code
                    </button>
                    {table.isOccupied && (
                      <button
                        onClick={() => resetTable(table.id)}
                        className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200 transition"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => deleteTable(table.id)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={orderFilters.startDate}
                    onChange={(e) => setOrderFilters(p => ({ ...p, startDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={orderFilters.endDate}
                    onChange={(e) => setOrderFilters(p => ({ ...p, endDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={orderFilters.status}
                    onChange={(e) => setOrderFilters(p => ({ ...p, status: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BILLED">Billed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Table</label>
                  <input
                    type="number"
                    placeholder="Table #"
                    value={orderFilters.tableNumber}
                    onChange={(e) => setOrderFilters(p => ({ ...p, tableNumber: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Search Item</label>
                  <input
                    type="text"
                    placeholder="Item name..."
                    value={orderFilters.search}
                    onChange={(e) => setOrderFilters(p => ({ ...p, search: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={() => fetchOrders(1)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition"
                >
                  Search
                </button>
                <button
                  onClick={() => setOrderFilters({ startDate: '', endDate: '', status: 'ALL', tableNumber: '', search: '' })}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Table</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                      <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Bill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <td className="p-4 font-mono text-gray-900">#{order.id}</td>
                        <td className="p-4 font-medium">T{order.table.tableNumber}</td>
                        <td className="p-4 text-gray-500 max-w-[200px] truncate">
                          {order.items.map(i => `${i.quantity}x ${i.menuItem.name}`).join(', ')}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="p-4 text-gray-500 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 text-right font-medium">
                          ₹{order.items.reduce((s, i) => s + i.price * i.quantity, 0)}
                        </td>
                        <td className="p-4 text-right">
                          {order.bill ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${order.bill.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {order.bill.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr><td colSpan="7" className="p-8 text-center text-gray-500">No orders found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {orderPagination.pages > 1 && (
                <div className="p-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    Showing {orders.length} of {orderPagination.total} orders
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={orderPagination.page === 1}
                      onClick={() => fetchOrders(orderPagination.page - 1)}
                      className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Page {orderPagination.page} of {orderPagination.pages}
                    </span>
                    <button
                      disabled={orderPagination.page === orderPagination.pages}
                      onClick={() => fetchOrders(orderPagination.page + 1)}
                      className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Date Range Selector */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end justify-between">
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(p => ({ ...p, startDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(p => ({ ...p, endDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={fetchRangeAnalytics}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition"
                >
                  Generate Report
                </button>
              </div>
              {rangeAnalytics && (
                <button
                  onClick={() => downloadReport(true)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-700 transition"
                >
                  Export CSV
                </button>
              )}
            </div>

            {rangeAnalytics ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total Revenue" value={`₹${rangeAnalytics.totalRevenue.toLocaleString('en-IN')}`} color="orange" />
                  <KPICard title="Total Orders" value={rangeAnalytics.totalOrders} color="blue" />
                  <KPICard title="Avg. Order Value" value={`₹${(rangeAnalytics.avgOrderValue ?? 0).toFixed(0)}`} color="green" />
                  <KPICard title="Peak Hour" value={rangeAnalytics.peakHour} color="purple" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Revenue */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Revenue</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rangeAnalytics.dailyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                          <RechartsTooltip formatter={(v) => `₹${v}`} />
                          <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue by Category</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={rangeAnalytics.categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            {rangeAnalytics.categoryData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip formatter={(v) => `₹${v}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Top Items Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Top Selling Items</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                          <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty Sold</th>
                          <th className="p-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rangeAnalytics.topItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3 text-gray-400">{idx + 1}</td>
                            <td className="p-3 font-medium text-gray-900">{item.name}</td>
                            <td className="p-3 text-gray-500">{item.category}</td>
                            <td className="p-3 text-right font-medium">{item.count}</td>
                            <td className="p-3 text-right font-bold text-gray-900">₹{item.revenue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
                <p className="text-gray-500">Select a date range and click "Generate Report" to view analytics</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      
      {/* Menu Item Modal */}
      {showMenuModal && (
        <MenuItemModal
          item={editingItem}
          onClose={() => { setShowMenuModal(false); setEditingItem(null); }}
          onSave={saveMenuItem}
        />
      )}

      {/* Table Modal */}
      {showTableModal && (
        <TableModal
          table={editingTable}
          onClose={() => { setShowTableModal(false); setEditingTable(null); }}
          onSave={saveTable}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <QRModal
          table={showQRModal}
          onClose={() => setShowQRModal(null)}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

// ==================== COMPONENTS ====================

const KPICard = ({ title, value, color }) => {
  const colorClasses = {
    orange: 'from-orange-500 to-red-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-pink-500'
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      <p className={`text-2xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent`}>
        {value}
      </p>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    PARTIALLY_READY: 'bg-purple-100 text-purple-700',
    COMPLETED: 'bg-green-100 text-green-700',
    BILLED: 'bg-gray-100 text-gray-700'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const MenuItemModal = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'STARTER',
    price: item?.price || '',
    isVeg: item?.isVeg ?? true,
    imageUrl: item?.imageUrl || '',
    prepTime: item?.prepTime || '',
    isSpecial: item?.isSpecial || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      alert('Name and price are required');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{item ? 'Edit Item' : 'Add New Item'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm(p => ({ ...p, imageUrl: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (minutes)</label>
            <input
              type="number"
              value={form.prepTime}
              onChange={(e) => setForm(p => ({ ...p, prepTime: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              min="0"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isVeg}
                onChange={(e) => setForm(p => ({ ...p, isVeg: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Vegetarian</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isSpecial}
                onChange={(e) => setForm(p => ({ ...p, isSpecial: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Chef's Special</span>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              {item ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TableModal = ({ table, onClose, onSave }) => {
  const [tableNumber, setTableNumber] = useState(table?.tableNumber || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tableNumber) {
      alert('Table number is required');
      return;
    }
    onSave(parseInt(tableNumber));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{table ? 'Edit Table' : 'Add New Table'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Table Number *</label>
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-center text-2xl font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              required
              min="1"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              {table ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const QRModal = ({ table, onClose }) => {
  const qrUrl = `${window.location.origin}/menu?table=${table.tableNumber}`;

  const downloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement('a');
      a.download = `table-${table.tableNumber}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const printQR = () => {
    const printWindow = window.open('', '', 'width=400,height=500');
    printWindow.document.write(`
      <html>
        <head><title>Table ${table.tableNumber} QR Code</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <h1 style="margin:0 0 20px 0;">Table ${table.tableNumber}</h1>
          <div style="padding:20px;border:2px solid #000;border-radius:12px;">
            ${document.getElementById('qr-code-svg').outerHTML}
          </div>
          <p style="margin-top:20px;color:#666;">Scan to view menu & order</p>
          <p style="font-size:12px;color:#999;margin-top:10px;">Escape Restaurant</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Table {table.tableNumber} QR Code</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 flex flex-col items-center">
          <div className="p-4 bg-white border-2 border-gray-200 rounded-xl mb-4">
            <QRCodeSVG
              id="qr-code-svg"
              value={qrUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-gray-500 mb-4 text-center break-all">{qrUrl}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={downloadQR}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Download
            </button>
            <button
              onClick={printQR}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderDetailModal = ({ order, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Order #{order.id}</h2>
            <p className="text-sm text-gray-500">Table {order.table.tableNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Status</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Created</span>
            <span className="font-medium">{new Date(order.createdAt).toLocaleString('en-IN')}</span>
          </div>
          
          <div className="border-t border-gray-100 pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.menuItem.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} × ₹{item.price}
                      {item.instructions && <span className="ml-2 text-orange-600">• {item.instructions}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{(item.quantity * item.price).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.itemStatus === 'DONE' ? 'bg-green-100 text-green-700' :
                      item.itemStatus === 'PREPARING' ? 'bg-blue-100 text-blue-700' :
                      item.itemStatus === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.itemStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.bill && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Bill Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{order.bill.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span>₹{order.bill.tax}</span>
                </div>
                {order.bill.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{order.bill.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span>₹{order.bill.total}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-500">Payment Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.bill.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.bill.isPaid ? `Paid at ${new Date(order.bill.paidAt).toLocaleTimeString('en-IN')}` : 'Unpaid'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
