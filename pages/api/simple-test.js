export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Simple test API works!',
    timestamp: new Date().toISOString(),
    method: req.method
  });
}
