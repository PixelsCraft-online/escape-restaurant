import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MenuCardGrid from '../components/MenuCardGrid';
import CartDrawer from '../components/CartDrawer';
import PremiumLogo from '../components/PremiumLogo';
import { useSocket } from '../socket/useSocket';

const CATEGORIES = [
  { id: 'STARTER', label: 'Starters' },
  { id: 'MAIN_VEG', label: 'Veg Mains' },
  { id: 'MAIN_NONVEG', label: 'Non-Veg' },
  { id: 'BREAD_RICE', label: 'Breads' },
  { id: 'DESSERT', label: 'Desserts' },
  { id: 'BEVERAGE', label: 'Drinks' }
];

const CustomerMenu = () => {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const urlTableNumber = searchParams.get('table');
  const orderId = searchParams.get('order');
  const navigate = useNavigate();

  // Session state
  const [sessionToken, setSessionToken] = useState(null);
  const [tableNumber, setTableNumber] = useState(null);
  const [sessionValidating, setSessionValidating] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  
  // Filters
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);

  // Validate or create session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check for existing token in sessionStorage
        const storedToken = sessionStorage.getItem('tableToken');
        const tokenToValidate = urlToken || storedToken;

        if (tokenToValidate) {
          // Validate existing token
          try {
            const res = await axios.get(`/api/session/validate/${tokenToValidate}`);
            if (res.data.valid) {
              setSessionToken(tokenToValidate);
              setTableNumber(res.data.tableNumber);
              sessionStorage.setItem('tableToken', tokenToValidate);
              sessionStorage.setItem('tableNumber', res.data.tableNumber);
              sessionStorage.setItem('tableId', res.data.tableId);
              
              // Update URL to use token if it was from storage
              if (!urlToken && storedToken) {
                navigate(`/menu?token=${storedToken}`, { replace: true });
              }
              setSessionValidating(false);
              return;
            }
          } catch (validationErr) {
            console.log('Token validation failed, will try to create new session');
          }
          
          // Token invalid - clear it
          sessionStorage.removeItem('tableToken');
          sessionStorage.removeItem('tableNumber');
          sessionStorage.removeItem('tableId');
        }

        // No valid token - need table number to create new session
        const tableNum = urlTableNumber || sessionStorage.getItem('tableNumber');
        if (tableNum) {
          const res = await axios.post('/api/session/start', {
            tableNumber: parseInt(tableNum)
          });
          
          setSessionToken(res.data.token);
          setTableNumber(res.data.tableNumber);
          sessionStorage.setItem('tableToken', res.data.token);
          sessionStorage.setItem('tableNumber', res.data.tableNumber);
          sessionStorage.setItem('tableId', res.data.tableId);
          
          // Redirect to token-based URL
          navigate(`/menu?token=${res.data.token}`, { replace: true });
          setSessionValidating(false);
          return;
        }

        // No token and no table number
        setSessionError('Please scan the QR code on your table to access the menu.');
        setSessionValidating(false);
      } catch (err) {
        console.error('Session initialization failed:', err);
        // Clear any stale session data
        sessionStorage.removeItem('tableToken');
        sessionStorage.removeItem('tableId');
        
        if (err.response?.status === 404) {
          setSessionError('Table not found. Please scan a valid QR code.');
        } else {
          setSessionError('Failed to start session. Please try scanning the QR code again.');
        }
        setSessionValidating(false);
      }
    };

    initSession();
  }, [urlToken, urlTableNumber, navigate]);

  // Configure axios to include token in requests
  useEffect(() => {
    if (sessionToken) {
      axios.defaults.headers.common['x-table-token'] = sessionToken;
    }
    return () => {
      delete axios.defaults.headers.common['x-table-token'];
    };
  }, [sessionToken]);

  useSocket('join_table', { tableNumber });

  useEffect(() => {
    if (!tableNumber || sessionValidating) return;
    
    const fetchData = async () => {
      try {
        const [tableRes, menuRes] = await Promise.all([
          axios.get(`/api/menu/table/${tableNumber}`),
          axios.get('/api/menu')
        ]);
        setTable(tableRes.data);
        setMenuItems(menuRes.data.items);
      } catch (err) {
        console.error('Failed to load data', err);
        if (err.response?.status === 401) {
          // Session expired - clear and show error
          sessionStorage.removeItem('tableToken');
          sessionStorage.removeItem('tableNumber');
          setSessionError('Your session has expired. Please scan the QR code again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tableNumber, sessionValidating]);

  // Apply filters
  const getFilteredItems = (items) => {
    let filtered = [...items];
    
    if (vegOnly) {
      filtered = filtered.filter(item => item.isVeg);
    }
    if (nonVegOnly) {
      filtered = filtered.filter(item => !item.isVeg);
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Group items by category
  const getItemsByCategory = () => {
    const filtered = getFilteredItems(menuItems);
    const grouped = {};
    
    CATEGORIES.forEach(cat => {
      const items = filtered.filter(item => item.category === cat.id);
      if (items.length > 0) {
        grouped[cat.id] = items;
      }
    });
    
    return grouped;
  };

  const itemsByCategory = getItemsByCategory();
  const availableCategories = CATEGORIES.filter(cat => itemsByCategory[cat.id]?.length > 0);

  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    
    socket.on('menu_item_toggled', ({ menuItemId, isAvailable }) => {
      setMenuItems(prev => prev.map(item => 
        item.id === menuItemId ? { ...item, isAvailable } : item
      ));
      if (!isAvailable) {
        setCart(prev => prev.filter(item => item.id !== menuItemId));
      }
    });

    // Handle session ended (bill paid)
    socket.on('session_ended', ({ message }) => {
      sessionStorage.removeItem('tableToken');
      sessionStorage.removeItem('tableNumber');
      sessionStorage.removeItem('tableId');
      alert(message || 'Thank you for dining with us!');
      setSessionError('Your session has ended. Please scan the QR code for a new session.');
    });

    return () => {
      socket.off('menu_item_toggled');
      socket.off('session_ended');
    };
  }, [socket]);

  const handleAdd = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, instructions: '' }];
    });
  };

  const handleRemove = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing.quantity === 1) {
        return prev.filter(i => i.id !== item.id);
      }
      return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const handleUpdateInstructions = (item, instructions) => {
    setCart(prev => prev.map(i => i.id === item.id ? { ...i, instructions } : i));
  };

  const scrollToCategory = (categoryId) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const submitOrder = async () => {
    if (!table || cart.length === 0 || !sessionToken) return;
    setPlacingOrder(true);
    
    try {
      const itemsPayload = cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
        instructions: item.instructions || null
      }));

      if (orderId) {
        await axios.patch(`/api/orders/${orderId}/items`, { items: itemsPayload });
      } else {
        await axios.post('/api/orders', { items: itemsPayload });
      }
      
      navigate(`/track?token=${sessionToken}`);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem('tableToken');
        sessionStorage.removeItem('tableNumber');
        alert('Session expired. Please scan the QR code again.');
        navigate('/menu');
      } else {
        alert('Failed to place order. Please try again.');
      }
      setPlacingOrder(false);
    }
  };

  // Session validating state
  if (sessionValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full"></div>
          <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-zinc-400 text-sm tracking-wide">Validating session...</p>
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

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full"></div>
          <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-zinc-400 text-sm tracking-wide">Loading experience...</p>
      </div>
    );
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalFilteredItems = Object.values(itemsByCategory).flat().length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-28 relative">
      {/* Global ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/[0.07] rounded-full blur-[120px]"></div>
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-orange-600/[0.05] rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-red-500/[0.04] rounded-full blur-[80px]"></div>
      </div>

      {/* Premium Hero Header */}
      <header className="relative overflow-hidden">
        {/* Header gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.08] via-orange-500/[0.04] to-transparent"></div>
        
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        {/* Animated orbs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-orange-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse"></div>
        <div className="absolute top-20 left-0 w-48 h-48 bg-gradient-to-br from-orange-500/15 to-red-500/5 rounded-full blur-2xl -translate-x-1/2"></div>
        
        {/* Header Content */}
        <div className="relative z-10 px-5 pt-6 pb-4">
          <div className="flex justify-between items-start">
            {/* Premium Logo Component */}
            <PremiumLogo size="default" animate={true} />
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button 
                onClick={() => navigate(`/track?token=${sessionToken}`)}
                className="h-11 px-5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold rounded-xl flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Track
              </button>
            </div>
          </div>
          
          {/* Table Info Card - Enhanced */}
          <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-xl shadow-black/20 relative overflow-hidden group hover:border-white/[0.15] transition-all duration-300">
            {/* Card inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Table number badge with glow */}
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10">
                    <span className="text-2xl font-black bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-transparent">{tableNumber}</span>
                  </div>
                  {/* Subtle glow behind */}
                  <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl -z-10"></div>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-medium">Table Number</p>
                  <p className="text-white font-semibold mt-0.5">Premium Seating</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Menu Items</p>
                <p className="text-3xl font-black bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">{menuItems.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar - Glassmorphism */}
        {showSearch && (
          <div className="relative z-10 px-5 pb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-12 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none text-sm"
                autoFocus
              />
              <svg className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category Pills - Premium Style */}
        <div className="relative z-10 px-5 pb-4 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2.5">
            {availableCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/40 scale-[1.02]'
                    : 'bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] hover:shadow-lg hover:shadow-black/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Toggles - Refined */}
        <div className="relative z-10 px-5 pb-5 flex items-center gap-3">
          <button 
            onClick={() => { setVegOnly(!vegOnly); setNonVegOnly(false); }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
              vegOnly 
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10' 
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.15]'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${vegOnly ? 'border-emerald-500 bg-emerald-500' : 'border-emerald-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${vegOnly ? 'bg-black' : 'bg-emerald-500'}`}></div>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide">Veg</span>
          </button>

          <button 
            onClick={() => { setNonVegOnly(!nonVegOnly); setVegOnly(false); }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
              nonVegOnly 
                ? 'bg-red-500/15 border-red-500/50 text-red-400 shadow-lg shadow-red-500/10' 
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.15]'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${nonVegOnly ? 'border-red-500 bg-red-500' : 'border-red-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${nonVegOnly ? 'bg-black' : 'bg-red-500'}`}></div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide">Non-Veg</span>
          </button>
        </div>
      </header>

      {/* Menu Content */}
      <main className="px-5 pt-2">
        {/* Category Sections */}
        {CATEGORIES.map(category => {
          const items = itemsByCategory[category.id];
          if (!items || items.length === 0) return null;

          return (
            <section key={category.id} id={`category-${category.id}`} className="mb-10">
              {/* Category Header - Enhanced */}
              <div className="flex items-center gap-4 mb-5">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/50 to-zinc-800"></div>
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">
                    {category.label}
                  </h2>
                  <span className="w-5 h-5 flex items-center justify-center bg-amber-500/20 rounded-full text-[10px] font-bold text-amber-400">{items.length}</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-zinc-700/50 to-zinc-800"></div>
              </div>
              
              {/* Desktop: Grid Layout / Mobile: List Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(item => {
                  const cartItem = cart.find(i => i.id === item.id);
                  return (
                    <MenuCardGrid 
                      key={item.id} 
                      item={item} 
                      quantity={cartItem?.quantity || 0}
                      instructions={cartItem?.instructions || ''}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      onUpdateInstructions={handleUpdateInstructions}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* No results */}
        {totalFilteredItems === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.08] flex items-center justify-center">
              <svg className="w-12 h-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No dishes found</h3>
            <p className="text-sm text-zinc-500 mb-6">Try adjusting your filters or search</p>
            <button 
              onClick={() => { setVegOnly(false); setNonVegOnly(false); setSearchQuery(''); }}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold rounded-xl"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      {/* Premium Floating Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full p-4 bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 rounded-2xl flex justify-between items-center shadow-2xl shadow-amber-500/30"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-black font-bold text-lg">{cartItemCount}</span>
              </div>
              <div className="text-left">
                <p className="text-black/60 text-xs font-medium">Your Order</p>
                <p className="text-black font-bold text-xl">₹{cartTotal.toFixed(0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-black font-bold bg-black/10 px-5 py-2.5 rounded-xl">
              <span>View Cart</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        subtotal={cartTotal}
        totalItems={cartItemCount}
        onSubmit={submitOrder}
        isSubmitting={placingOrder}
        onAdd={handleAdd}
        onRemove={handleRemove}
        darkMode={true}
      />

      {/* Footer - Developer Credit */}
      <footer className={`mt-10 ${cart.length > 0 ? 'pb-24' : 'pb-6'} px-5`}>
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
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default CustomerMenu;
