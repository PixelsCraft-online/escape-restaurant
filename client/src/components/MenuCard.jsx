import React, { useState } from 'react';

const MenuCard = ({ item, quantity = 0, onAdd, onRemove, onUpdateInstructions, instructions = '' }) => {
  const isVeg = item.isVeg;
  const [showInstructions, setShowInstructions] = useState(false);
  const [localInstructions, setLocalInstructions] = useState(instructions);

  const handleInstructionsSave = () => {
    onUpdateInstructions?.(item, localInstructions);
    setShowInstructions(false);
  };

  return (
    <div className={`px-4 py-4 flex gap-4 ${!item.isAvailable ? 'opacity-50' : ''}`}>
      {/* Left: Item Details */}
      <div className="flex-1 min-w-0 pr-2">
        {/* Veg/Non-veg indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${isVeg ? 'border-green-600' : 'border-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
          </div>
        </div>

        {/* Name */}
        <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>
        
        {/* Price */}
        <p className="text-sm font-medium text-gray-900 mt-1">₹ {item.price}</p>

        {/* Description with gray text */}
        {item.description && (
          <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Prep time or serves info */}
        {item.prepTime && (
          <p className="text-xs text-gray-400 mt-1">[Serves 2]</p>
        )}

        {/* Special Instructions - only when item is in cart */}
        {quantity > 0 && (
          <div className="mt-3">
            {showInstructions ? (
              <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                <textarea
                  value={localInstructions}
                  onChange={(e) => setLocalInstructions(e.target.value)}
                  placeholder="Add cooking instructions..."
                  className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleInstructionsSave}
                    className="flex-1 text-xs bg-green-600 text-white py-2 rounded-lg font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setLocalInstructions(instructions);
                      setShowInstructions(false);
                    }}
                    className="flex-1 text-xs bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowInstructions(true)}
                className="text-xs text-gray-500 hover:text-green-600"
              >
                {instructions ? `Note: ${instructions}` : '+ Add note'}
              </button>
            )}
          </div>
        )}

        {/* Unavailable message */}
        {!item.isAvailable && (
          <p className="text-xs text-red-500 mt-2">Currently unavailable</p>
        )}
      </div>

      {/* Right: Image with ADD button overlay - KFC Style */}
      <div className="flex-shrink-0 relative">
        {/* Large Image */}
        <div className="w-32 h-28 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15l-5-5L5 21" strokeWidth="1"/>
              </svg>
            </div>
          )}
        </div>

        {/* ADD Button overlaid at bottom right of image */}
        {item.isAvailable && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            {quantity > 0 ? (
              <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-md">
                <button 
                  onClick={() => onRemove(item)}
                  className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-gray-50 active:bg-gray-100 border-r border-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-6 text-center font-bold text-green-600 text-sm">{quantity}</span>
                <button 
                  onClick={() => onAdd(item)}
                  className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-gray-50 active:bg-gray-100 border-l border-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => onAdd(item)}
                className="px-5 py-1.5 bg-white border border-gray-200 rounded-lg text-green-600 font-bold text-sm hover:shadow-lg shadow-md transition-shadow"
              >
                ADD
              </button>
            )}
          </div>
        )}

        {/* Small + indicator when quantity is 0 */}
        {item.isAvailable && quantity === 0 && (
          <div className="absolute bottom-0 right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center shadow border border-gray-200">
            <span className="text-green-600 text-xs font-bold">+</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuCard;
