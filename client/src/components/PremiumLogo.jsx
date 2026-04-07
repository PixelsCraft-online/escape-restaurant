import React, { useState, useEffect } from 'react';

const PremiumLogo = ({ size = 'default', animate = true, variant = 'full' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const sizes = {
    small: { 
      container: 'gap-2',
      plate: 'w-10 h-10',
      plateInner: 'w-7 h-7',
      text: 'text-xl', 
      tagline: 'text-[8px]',
      steam: 'h-3'
    },
    default: { 
      container: 'gap-3',
      plate: 'w-14 h-14',
      plateInner: 'w-9 h-9',
      text: 'text-2xl md:text-3xl', 
      tagline: 'text-[9px] md:text-[10px]',
      steam: 'h-4'
    },
    large: {
      container: 'gap-4',
      plate: 'w-16 h-16',
      plateInner: 'w-11 h-11',
      text: 'text-3xl md:text-4xl',
      tagline: 'text-[10px] md:text-xs',
      steam: 'h-5'
    }
  };
  const s = sizes[size];

  // Steaming plate icon with food
  const PlateIcon = () => (
    <div 
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outer ring with gradient border */}
      <div className={`${s.plate} rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-[2px] shadow-lg shadow-orange-500/40 transition-all duration-500 ${animate && mounted ? 'scale-100 rotate-0' : 'scale-0 rotate-180'} ${isHovered ? 'scale-110 shadow-orange-500/60' : ''}`}>
        {/* Inner dark plate */}
        <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
          {/* Food bowl/cloche */}
          <div className={`${s.plateInner} rounded-full bg-gradient-to-b from-amber-400/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center relative overflow-hidden`}>
            {/* Steam rising from plate */}
            <div className={`absolute -top-1 left-1/2 -translate-x-1/2 flex gap-1 transition-opacity duration-300 ${isHovered || animate ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`w-0.5 ${s.steam} bg-gradient-to-t from-amber-300/0 via-amber-200/40 to-white/0 rounded-full animate-steam-rise`}></div>
              <div className={`w-0.5 ${s.steam} bg-gradient-to-t from-amber-300/0 via-amber-200/30 to-white/0 rounded-full animate-steam-rise-delay`}></div>
              <div className={`w-0.5 ${s.steam} bg-gradient-to-t from-amber-300/0 via-amber-200/20 to-white/0 rounded-full animate-steam-rise-slow`}></div>
            </div>
            
            {/* Fork & Spoon crossed */}
            <svg className="w-5 h-5 text-amber-400 drop-shadow-sm transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor" style={{ transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)' }}>
              {/* Fork */}
              <path d="M7 2v4c0 .55-.45 1-1 1s-1-.45-1-1V2H4v4c0 .55-.45 1-1 1s-1-.45-1-1V2H1v5c0 1.1.9 2 2 2v13h2V9c1.1 0 2-.9 2-2V2H7z" opacity="0.9"/>
              {/* Spoon */}
              <path d="M18 2c-2.21 0-4 1.79-4 4 0 1.86 1.28 3.41 3 3.86V22h2V9.86c1.72-.45 3-2 3-3.86 0-2.21-1.79-4-4-4z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Sparkle particles on hover */}
      {animate && (
        <>
          <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300 transition-all duration-300 ${isHovered ? 'opacity-100 scale-100 animate-sparkle' : 'opacity-0 scale-0'}`}></div>
          <div className={`absolute -top-2 left-0 w-1.5 h-1.5 rounded-full bg-orange-400 transition-all duration-300 delay-100 ${isHovered ? 'opacity-100 scale-100 animate-sparkle-delay' : 'opacity-0 scale-0'}`}></div>
          <div className={`absolute top-1/2 -right-2 w-1 h-1 rounded-full bg-yellow-300 transition-all duration-300 delay-200 ${isHovered ? 'opacity-100 scale-100 animate-sparkle' : 'opacity-0 scale-0'}`}></div>
        </>
      )}
      
      {/* Ambient glow */}
      <div className={`absolute inset-0 ${s.plate} rounded-full bg-orange-500 blur-xl transition-opacity duration-500 -z-10 ${isHovered ? 'opacity-40' : 'opacity-20'}`}></div>
    </div>
  );

  // Animated brand text with food integration
  const BrandText = () => {
    const letters = [
      { char: 'E', gradient: 'from-amber-200 via-amber-300 to-amber-400', delay: 0 },
      { char: 'S', gradient: 'from-amber-300 via-yellow-300 to-amber-400', delay: 50, hasChili: true },
      { char: 'C', gradient: 'from-yellow-200 via-amber-300 to-orange-400', delay: 100 },
      { char: 'A', gradient: 'from-amber-300 via-orange-400 to-orange-500', delay: 150, hasPlate: true },
      { char: 'P', gradient: 'from-orange-300 via-orange-400 to-red-500', delay: 200 },
      { char: 'E', gradient: 'from-orange-400 via-red-400 to-red-500', delay: 250, hasSteam: true },
    ];

    return (
      <div className="relative">
        {/* Main text */}
        <div className={`${s.text} font-black tracking-tight leading-none flex items-baseline`}>
          {letters.map((letter, idx) => (
            <span 
              key={idx}
              className={`relative bg-gradient-to-b ${letter.gradient} bg-clip-text text-transparent transition-all duration-300 inline-block ${animate && mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${animate ? 'hover:scale-110 cursor-default' : ''}`}
              style={{ 
                transitionDelay: animate ? `${letter.delay}ms` : '0ms',
                fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif"
              }}
            >
              {letter.char}
              
              {/* Chili pepper on S */}
              {letter.hasChili && animate && (
                <span className="absolute -top-1.5 -right-0.5 text-[8px] animate-wiggle">
                  <svg className="w-2 h-2 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.5 2 5.5 4.5 4.5 8c-.5 2 0 4 1 5.5 1 1.5 2.5 2.5 4 3 1.5.5 3 .5 4.5 0 1.5-.5 3-1.5 4-3 1-1.5 1.5-3.5 1-5.5C18.5 4.5 15.5 2 12 2z"/>
                    <path d="M12 1c.5 0 1-.5 1-1s-.5-1-1-1-1 .5-1 1 .5 1 1 1z" opacity="0.6"/>
                  </svg>
                </span>
              )}
              
              {/* Small plate/dot above A */}
              {letter.hasPlate && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-sm shadow-orange-400/50"></span>
              )}
              
              {/* Steam on final E */}
              {letter.hasSteam && animate && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-0.5">
                  <span className="w-[2px] h-2.5 bg-gradient-to-t from-transparent via-amber-300/50 to-transparent rounded-full animate-steam-rise"></span>
                  <span className="w-[2px] h-2 bg-gradient-to-t from-transparent via-amber-200/40 to-transparent rounded-full animate-steam-rise-delay"></span>
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <div className={`flex items-center justify-center gap-2 mt-1 transition-all duration-500 ${animate && mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} style={{ transitionDelay: '350ms' }}>
          <span className="w-4 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-amber-500/60"></span>
          <span className={`${s.tagline} text-amber-400/70 font-medium tracking-[0.25em] uppercase`}>
            Taste the
          </span>
          <span className={`${s.tagline} text-amber-300 font-bold tracking-[0.2em] uppercase`}>
            Experience
          </span>
          <span className="w-4 h-px bg-gradient-to-r from-amber-500/60 via-amber-500/40 to-transparent"></span>
        </div>
        
        {/* Animated underline */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full transition-all duration-700 ${animate && mounted ? 'w-full opacity-40' : 'w-0 opacity-0'}`}></div>
      </div>
    );
  };

  // Compact variant for mobile header
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2`}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-[2px] shadow-md shadow-orange-500/30">
          <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2v4c0 .55-.45 1-1 1s-1-.45-1-1V2H4v4c0 .55-.45 1-1 1s-1-.45-1-1V2H1v5c0 1.1.9 2 2 2v13h2V9c1.1 0 2-.9 2-2V2H7z"/>
              <path d="M18 2c-2.21 0-4 1.79-4 4 0 1.86 1.28 3.41 3 3.86V22h2V9.86c1.72-.45 3-2 3-3.86 0-2.21-1.79-4-4-4z"/>
            </svg>
          </div>
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
          ESCAPE
        </span>

        {/* CSS for compact variant */}
        <style>{`
          @keyframes steam-rise {
            0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.6; }
            50% { transform: translateY(-6px) scaleY(1.3); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center ${s.container} select-none`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PlateIcon />
      <BrandText />
      
      {/* Global animations */}
      <style>{`
        @keyframes steam-rise {
          0% { transform: translateY(0) scaleY(1); opacity: 0.4; }
          50% { transform: translateY(-8px) scaleY(1.5); opacity: 0.6; }
          100% { transform: translateY(-16px) scaleY(1); opacity: 0; }
        }
        @keyframes steam-rise-delay {
          0% { transform: translateY(0) scaleY(1); opacity: 0.3; }
          50% { transform: translateY(-6px) scaleY(1.4); opacity: 0.5; }
          100% { transform: translateY(-12px) scaleY(1); opacity: 0; }
        }
        @keyframes steam-rise-slow {
          0% { transform: translateY(0) scaleY(1); opacity: 0.2; }
          50% { transform: translateY(-5px) scaleY(1.3); opacity: 0.4; }
          100% { transform: translateY(-10px) scaleY(1); opacity: 0; }
        }
        @keyframes sparkle {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
        @keyframes sparkle-delay {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .animate-steam-rise { animation: steam-rise 2s ease-out infinite; }
        .animate-steam-rise-delay { animation: steam-rise-delay 2s ease-out infinite 0.3s; }
        .animate-steam-rise-slow { animation: steam-rise-slow 2s ease-out infinite 0.6s; }
        .animate-sparkle { animation: sparkle 1s ease-in-out infinite; }
        .animate-sparkle-delay { animation: sparkle-delay 1s ease-in-out infinite 0.2s; }
        .animate-wiggle { animation: wiggle 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default PremiumLogo;
