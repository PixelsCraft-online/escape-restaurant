import React, { useState } from 'react';

// High-quality food placeholder images from Unsplash
const PLACEHOLDER_IMAGES = {
  STARTER: [
    'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400&h=400&fit=crop&q=80',
  ],
  MAIN_VEG: [
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=400&fit=crop&q=80',
  ],
  MAIN_NONVEG: [
    'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop&q=80',
  ],
  BREAD_RICE: [
    'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&h=400&fit=crop&q=80',
  ],
  DESSERT: [
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=400&fit=crop&q=80',
  ],
  BEVERAGE: [
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop&q=80',
  ],
};

const getPlaceholderImage = (item) => {
  const images = PLACEHOLDER_IMAGES[item.category] || PLACEHOLDER_IMAGES.STARTER;
  const index = item.id % images.length;
  return images[index];
};

const MenuCardGrid = ({ item, quantity = 0, onAdd, onRemove, onUpdateInstructions, instructions = '' }) => {
  const isVeg = item.isVeg;
  const [imageError, setImageError] = useState(false);
  
  const placeholderImage = getPlaceholderImage(item);
  const displayImage = item.image && !imageError ? item.image : placeholderImage;

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-white/20 transition-all duration-300 ${!item.isAvailable ? 'opacity-40' : ''}`}>
      {/* Card Layout - Responsive */}
      <div className="flex gap-4 p-3">
        {/* Image Container */}
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-xl overflow-hidden bg-zinc-800/50">
            <img 
              src={displayImage} 
              alt={item.name} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          </div>
          
          {/* Veg/Non-veg indicator */}
          <div className={`absolute top-2 left-2 w-5 h-5 rounded-md backdrop-blur-sm flex items-center justify-center border-2 ${
            isVeg 
              ? 'bg-emerald-500/20 border-emerald-500' 
              : 'bg-red-500/20 border-red-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          </div>

          {/* Quantity badge when in cart */}
          {quantity > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-[10px] font-bold text-black">{quantity}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <h3 className="font-semibold text-white text-sm lg:text-base leading-snug line-clamp-2 group-hover:text-amber-200 transition-colors">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-zinc-500 text-xs mt-1 line-clamp-1 lg:line-clamp-2">{item.description}</p>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-2">
            {/* Price */}
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-zinc-500">₹</span>
              <span className="text-lg lg:text-xl font-bold text-white">{item.price.toFixed(0)}</span>
            </div>

            {/* Action Button */}
            <div className="flex-shrink-0">
              {!item.isAvailable ? (
                <span className="px-3 py-1.5 text-xs text-zinc-600 bg-zinc-800/50 rounded-lg">Unavailable</span>
              ) : quantity > 0 ? (
                <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                  <button 
                    onClick={() => onRemove(item)}
                    className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center font-bold text-white text-sm">{quantity}</span>
                  <button 
                    onClick={() => onAdd(item)}
                    className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => onAdd(item)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  ADD
                </button>
              )}
            </div>
          </div>

          {/* Instructions note */}
          {quantity > 0 && instructions && (
            <p className="text-amber-500/70 text-[10px] mt-1.5 truncate flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {instructions}
            </p>
          )}
        </div>
      </div>

      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5"></div>
      </div>
    </div>
  );
};

export default MenuCardGrid;
