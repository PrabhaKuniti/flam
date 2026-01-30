/**
 * Vercel serverless function: returns the Socket.io backend URL.
 * Set SOCKET_URL in Vercel Environment Variables to your backend (e.g. Railway).
 */

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const socketUrl = process.env.SOCKET_URL || '';
  res.status(200).json({ socketUrl });
};
