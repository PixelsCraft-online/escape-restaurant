import React from 'react';

const CartDrawer = ({ isOpen, onClose, cart, onSubmit, totalItems, subtotal, isSubmitting, onAdd, onRemove, darkMode = false }) => {
  if (!isOpen) return null;

  const gstAmount = subtotal * 0.05;
  const total = subtotal + gstAmount;

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity z-40 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose}
      />
      
      {/* Premium Glass Drawer */}
      <div className={`fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'} max-h-[85vh] flex flex-col border-t border-white/10`}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-zinc-700 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center border-b border-white/[0.06]">
          <div>
            <h2 className="text-xl font-bold text-white">Your Cart</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{totalItems} item{totalItems > 1 ? 's' : ''} added</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items */}
        <div className="px-5 py-4 overflow-y-auto flex-1 pb-44">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Your cart is empty</h3>
              <p className="text-sm text-zinc-500 mb-6">Add items to get started</p>
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-bold rounded-xl"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  {/* Veg/Non-veg indicator */}
                  <div className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center mt-0.5 ${item.isVeg ? 'border-emerald-500' : 'border-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white text-sm">{item.name}</h4>
                    <p className="text-sm text-amber-400 mt-0.5 font-semibold">₹{item.price}</p>
                    {item.instructions && (
                      <p className="text-xs text-amber-500/60 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        {item.instructions}
                      </p>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                      <button 
                        onClick={() => onRemove(item)}
                        className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-white">{item.quantity}</span>
                      <button 
                        onClick={() => onAdd(item)}
                        className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <span className="font-semibold text-white text-sm w-16 text-right">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                </div>
              ))}
              
              {/* Bill Details - Premium Glass */}
              <div className="pt-5 mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent"></div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.15em]">Bill Summary</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-zinc-800 to-transparent"></div>
                </div>
                
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Item Total</span>
                    <span className="text-white">₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">GST & Charges</span>
                    <span className="text-white">₹{gstAmount.toFixed(0)}</span>
                  </div>
                  <div className="border-t border-white/[0.06] pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-white">To Pay</span>
                      <span className="font-bold text-xl bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent">₹{total.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Submit Button - Premium */}
        {cart.length > 0 && (
          <div className="p-5 bg-zinc-900/95 backdrop-blur-xl border-t border-white/[0.06] fixed bottom-0 left-0 right-0 safe-area-bottom">
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-zinc-600 disabled:to-zinc-600 rounded-xl py-4 font-bold flex justify-between items-center px-5 transition-all shadow-lg shadow-amber-500/25 text-black"
            >
              <span className="text-base">{isSubmitting ? 'Placing Order...' : 'Place Order'}</span>
              <span className="text-lg">₹{total.toFixed(0)}</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </>
  );
};

export default CartDrawer;
