import Pusher from 'pusher-js';

let pusher: Pusher | null = null;

export function getPusher(): Pusher {
  if (!pusher) {
    pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY || '', {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
      forceTLS: true,
    });
  }
  return pusher;
}

export function subscribeToRoom(roomCode: string) {
  const p = getPusher();
  return p.subscribe(`room-${roomCode}`);
}

export function unsubscribeFromRoom(roomCode: string) {
  const p = getPusher();
  p.unsubscribe(`room-${roomCode}`);
}
