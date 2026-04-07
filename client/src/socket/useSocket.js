import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;
let connectionCount = 0;

export const useSocket = (roomAction, roomData = {}) => {
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    // Create shared socket connection if not exists
    if (!sharedSocket) {
      sharedSocket = io('/', { transports: ['websocket'] });
      sharedSocket.on('connect', () => {
        console.log('Socket connected:', sharedSocket.id);
      });
    }
    connectionCount++;

    // Join room when socket is ready and we have valid room data
    const joinRoom = () => {
      if (roomAction && roomData && !hasJoinedRef.current) {
        // Check if roomData has meaningful values (not null/undefined)
        const hasValidData = Object.values(roomData).every(v => v !== null && v !== undefined);
        if (hasValidData) {
          sharedSocket.emit(roomAction, roomData);
          hasJoinedRef.current = true;
          console.log(`Joined room: ${roomAction}`, roomData);
        }
      }
    };

    if (sharedSocket.connected) {
      joinRoom();
    } else {
      sharedSocket.on('connect', joinRoom);
    }

    return () => {
      connectionCount--;
      hasJoinedRef.current = false;
      if (connectionCount === 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, [roomAction, JSON.stringify(roomData)]);

  return sharedSocket;
};
