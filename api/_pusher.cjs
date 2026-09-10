const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});

exports.pusher = pusher;

exports.fire = async function fire(channel, event, data) {
  try {
    await pusher.trigger(channel, event, data);
  } catch {
    // Pusher not configured or unreachable — REST fallback covers clients
  }
};