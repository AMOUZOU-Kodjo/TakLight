export function errorHandler(err, _req, res, _next) {
  console.error('Error:', err);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}
