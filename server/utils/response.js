function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function ok(res, payload = {}) {
  json(res, 200, payload);
}

function created(res, payload = {}) {
  json(res, 201, payload);
}

function badRequest(res, message, details) {
  json(res, 400, { error: message, details });
}

function unauthorized(res, message = 'unauthorized') {
  json(res, 401, { error: message });
}

function notFound(res, message = 'not-found') {
  json(res, 404, { error: message });
}

function methodNotAllowed(res) {
  json(res, 405, { error: 'method-not-allowed' });
}

function serverError(res, error) {
  json(res, 500, { error: 'server-error', message: error.message });
}

module.exports = {
  json,
  ok,
  created,
  badRequest,
  unauthorized,
  notFound,
  methodNotAllowed,
  serverError
};
