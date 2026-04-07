import React, { useState, useEffect, useRef } from 'react';

const Timer = ({ startTime, mode = 'kitchen' }) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!startTime) return;
    
    startRef.current = new Date(startTime).getTime();
    
    // Calculate initial value
    const initialElapsed = Math.floor((Date.now() - startRef.current) / 1000);
    setElapsed(initialElapsed);
    
    // Update every second
    const interval = setInterval(() => {
      if (startRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Format MM:SS
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Determine color based on time elapsed
  let colorClass = 'bg-gray-700 text-white';

  if (mode === 'kitchen') {
    if (mins < 10) colorClass = 'bg-green-600 text-white';
    else if (mins < 20) colorClass = 'bg-yellow-500 text-white';
    else colorClass = 'bg-red-600 text-white';
  } else if (mode === 'customer') {
    colorClass = 'text-gray-600 font-mono text-sm';
  }

  return (
    <span className={`px-2.5 py-1 rounded-lg inline-flex items-center text-sm font-semibold ${colorClass}`}>
      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeStr}
    </span>
  );
};

export default Timer;
