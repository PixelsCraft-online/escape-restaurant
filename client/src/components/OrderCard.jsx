import React, { useState, useEffect } from 'react';
import Timer from './Timer';

const OrderCard = ({ order, onItemAction, onDeliver }) => {
  const [showFinished, setShowFinished] = useState(false);
  const [urgency, setUrgency] = useState('normal');
  
  const activeItems = order.items.filter(i => i.itemStatus === 'PENDING' || i.itemStatus === 'PREPARING');
  const finishedItems = order.items.filter(i => ['DONE', 'SKIPPED', 'OUT_OF_STOCK'].includes(i.itemStatus));
  const isAllFinished = activeItems.length === 0 && finishedItems.length > 0;

  // Calculate urgency based on time - in useEffect to avoid impure render
  useEffect(() => {
    const orderTime = new Date(order.createdAt).getTime();
    
    const calculateUrgency = () => {
      const minutesElapsed = Math.floor((Date.now() - orderTime) / 60000);
      if (minutesElapsed > 15) return 'urgent';
      if (minutesElapsed > 10) return 'warning';
      return 'normal';
    };
    
    setUrgency(calculateUrgency());
    
    const interval = setInterval(() => {
      setUrgency(calculateUrgency());
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [order.createdAt]);
  
  const urgencyStyles = {
    urgent: 'border-red-600 bg-gray-900',
    warning: 'border-amber-600 bg-gray-900',
    normal: 'border-gray-700 bg-gray-900'
  };

  const handleMarkAllDone = () => {
    activeItems.forEach(item => {
      onItemAction(item.id, 'DONE');
    });
  };

  return (
    <div className={`rounded-xl flex flex-col overflow-hidden border ${urgencyStyles[urgency]}`}>
      {/* Header - Table Number & Timer */}
      <div className={`px-4 py-3 flex justify-between items-center border-b border-gray-800 ${
        urgency === 'urgent' ? 'bg-red-900/30' : urgency === 'warning' ? 'bg-amber-900/20' : 'bg-gray-800/50'
      }`}>
        <div className="flex items-center gap-3">
          {/* Urgency Indicator */}
          {urgency === 'urgent' && (
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
          )}
          {urgency === 'warning' && (
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
          )}
          
          <div>
            <h2 className="text-2xl font-bold text-white">
              Table {order.table.tableNumber}
            </h2>
            <p className="text-xs text-gray-500">Order #{order.id}</p>
          </div>
        </div>
        
        <div className="text-right">
          <Timer startTime={order.createdAt} mode="kitchen" />
        </div>
      </div>

      {/* Items Count Summary */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-800/50 bg-gray-800/30">
        <span className="text-xs text-gray-400">
          {activeItems.length} pending · {finishedItems.length} done
        </span>
        {activeItems.length > 1 && (
          <button
            onClick={handleMarkAllDone}
            className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-medium transition-colors"
          >
            All Done
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 p-3 space-y-2 max-h-[350px] overflow-y-auto">
        {/* Active Items - NO PRICES shown */}
        {activeItems.map((item) => (
          <div key={item.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            {/* Item Name & Quantity */}
            <div className="flex items-start gap-3 mb-2">
              <span className="bg-blue-600 text-white font-bold text-lg w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                {item.quantity}x
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-white leading-tight">{item.menuItem.name}</p>
                {/* Veg/Non-veg indicator */}
                <div className="flex items-center gap-1 mt-1">
                  <span className={`w-2 h-2 rounded-full ${item.menuItem.isVeg ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className={`text-xs ${item.menuItem.isVeg ? 'text-green-400' : 'text-red-400'}`}>
                    {item.menuItem.isVeg ? 'Veg' : 'Non-Veg'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Special Instructions - Highlighted */}
            {item.instructions && (
              <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-2 mb-2">
                <p className="text-amber-300 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>{item.instructions}</span>
                </p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onItemAction(item.id, 'DONE')}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Done
              </button>
              <button
                onClick={() => onItemAction(item.id, 'OOS')}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                title="Out of Stock"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </button>
              <button
                onClick={() => onItemAction(item.id, 'SKIP')}
                className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                title="Skip"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Finished Items Section */}
        {finishedItems.length > 0 && (
          <div className="border-t border-gray-700 pt-2 mt-3">
            <button 
              onClick={() => setShowFinished(!showFinished)}
              className="w-full flex items-center justify-between text-gray-400 hover:text-gray-300 py-2"
            >
              <span className="text-xs font-medium uppercase tracking-wider">
                Processed ({finishedItems.length})
              </span>
              <svg className={`w-4 h-4 transition-transform ${showFinished ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showFinished && (
              <ul className="space-y-1 mt-1">
                {finishedItems.map(item => (
                  <li key={item.id} className="flex justify-between items-center text-sm py-2 px-3 rounded-lg bg-gray-800/50">
                    <span className="text-gray-400">{item.quantity}x {item.menuItem.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      item.itemStatus === 'DONE' ? 'bg-green-900/50 text-green-400' : 
                      item.itemStatus === 'OUT_OF_STOCK' ? 'bg-red-900/50 text-red-400' : 
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {item.itemStatus === 'DONE' ? 'Done' : item.itemStatus === 'OUT_OF_STOCK' ? 'OOS' : 'Skipped'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Footer - Deliver Button */}
      {isAllFinished && order.status !== 'COMPLETED' && (
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => onDeliver(order.id)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark Delivered
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
