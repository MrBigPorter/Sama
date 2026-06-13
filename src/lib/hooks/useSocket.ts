/**
 * React hook for subscribing to Socket.IO events.
 *
 * Automatically handles cleanup on unmount.
 *
 * Usage:
 *   useSocket('message_created', (msg) => {
 *     console.log('New message:', msg);
 *   });
 *
 *   // With specific event name
 *   useSocket(SocketEvent.MESSAGE_CREATED, handleNewMessage);
 */
import { useEffect } from 'react';
import { socketService } from '@/services/socketService';

type EventCallback<T = any> = (data: T) => void;

/**
 * Subscribe to a Socket.IO event. Unsubscribes on unmount.
 *
 * @param event - Event name (use SocketEvent constants)
 * @param callback - Handler for the event data
 * @param deps - Optional dependency array (default: [])
 */
export function useSocket<T = any>(
  event: string,
  callback: EventCallback<T>,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    const unsubscribe = socketService.on(event, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
