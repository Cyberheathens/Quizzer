import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});

export default pusher;

export async function fire(channel: string, event: string, data: unknown) {
  try {
    await pusher.trigger(channel, event, data);
  } catch {
    // Pusher not configured or unreachable — REST fallback covers clients
  }
}