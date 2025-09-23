const { parseBody } = require('./utils/body');
const { ok, created, badRequest, notFound, methodNotAllowed, serverError } = require('./utils/response');
const listingService = require('./services/listingService');
const orderService = require('./services/orderService');
const walletService = require('./services/walletService');
const promotionService = require('./services/promotionService');
const adminService = require('./services/adminService');
const { getConfig, updateConfig } = require('./services/configService');
const { getUsers, getUser } = require('./services/userService');
const { smartPricing, checklist, suggestCategory } = require('./services/aiPricingService');
const { scanListing } = require('./services/aiModerationService');
const notificationService = require('./services/notificationService');

async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace('/api', '') || '/';
  const method = req.method || 'GET';
  const locale = url.searchParams.get('locale') || 'ar';
  const actorId = req.headers['x-user-id'] || url.searchParams.get('userId');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-User-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-User-Id'
    });
    res.end();
    return;
  }

  try {
    if (path === '/health' && method === 'GET') {
      ok(res, { status: 'ok' });
      return;
    }

    if (path === '/config') {
      if (method === 'GET') {
        ok(res, getConfig());
        return;
      }
      if (method === 'PATCH') {
        const body = await parseBody(req);
        const updated = updateConfig(body || {});
        ok(res, updated);
        return;
      }
      methodNotAllowed(res);
      return;
    }

    if (path === '/users' && method === 'GET') {
      ok(res, { users: getUsers() });
      return;
    }

    const userMatch = path.match(/^\/users\/(.+)$/);
    if (userMatch) {
      if (method === 'GET') {
        const user = getUser(userMatch[1]);
        if (!user) {
          notFound(res, 'user-not-found');
          return;
        }
        ok(res, { user });
        return;
      }
      methodNotAllowed(res);
      return;
    }

    if (path === '/listings' && method === 'GET') {
      const filters = {
        query: url.searchParams.get('q') || url.searchParams.get('query'),
        category: url.searchParams.get('category'),
        city: url.searchParams.get('city'),
        condition: url.searchParams.get('condition'),
        minPrice: url.searchParams.get('minPrice'),
        maxPrice: url.searchParams.get('maxPrice'),
        sort: url.searchParams.get('sort'),
        sellerId: url.searchParams.get('sellerId'),
        includeAll: url.searchParams.get('includeAll') === 'true'
      };
      ok(res, listingService.listListings(filters, locale));
      return;
    }

    if (path === '/listings' && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const result = listingService.createListing(body || {}, actorId);
        created(res, result);
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    const listingMatch = path.match(/^\/listings\/([^/]+)$/);
    if (listingMatch) {
      const listingId = listingMatch[1];
      if (method === 'GET') {
        const listing = listingService.getListingById(listingId, locale);
        if (!listing) {
          notFound(res, 'listing-not-found');
          return;
        }
        ok(res, { listing });
        return;
      }
      if (method === 'POST') {
        const action = url.searchParams.get('action');
        if (action === 'bump') {
          if (!actorId) {
            badRequest(res, 'missing-user');
            return;
          }
          try {
            const response = listingService.bumpListing(listingId, actorId);
            ok(res, response);
          } catch (error) {
            badRequest(res, error.message);
          }
          return;
        }
        if (action === 'buy') {
          if (!actorId) {
            badRequest(res, 'missing-user');
            return;
          }
          try {
            const order = orderService.createOrder(listingId, actorId);
            created(res, { order });
          } catch (error) {
            badRequest(res, error.message);
          }
          return;
        }
      }
      methodNotAllowed(res);
      return;
    }

    if (path === '/orders' && method === 'GET') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const role = url.searchParams.get('role') || 'buyer';
      const orders = orderService.getOrders({ userId: actorId, role }, locale);
      ok(res, { orders });
      return;
    }

    const orderStatusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
    if (orderStatusMatch && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const order = orderService.advanceStatus(orderStatusMatch[1], actorId, body || {});
        ok(res, { order });
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    const disputeMatch = path.match(/^\/orders\/([^/]+)\/dispute$/);
    if (disputeMatch && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const dispute = orderService.openDispute(disputeMatch[1], actorId, body || {});
        created(res, { dispute });
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    if (path === '/wallet' && method === 'GET') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      try {
        const wallet = walletService.getWallet(actorId);
        ok(res, wallet);
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    if (path === '/wallet/topup' && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const amount = Number(body.amountSDG || body.amount || 0);
        if (!amount) {
          throw new Error('invalid-amount');
        }
        const result = walletService.topUp(actorId, amount, body.method || 'manual', body.proofUrl || null);
        ok(res, result);
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    if (path === '/notifications' && method === 'GET') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const notifications = notificationService.getNotifications(actorId);
      ok(res, { notifications });
      return;
    }

    if (path === '/promotions/store' && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const response = promotionService.bumpStore(body.storeId, actorId);
        ok(res, response);
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    if (path === '/admin/dashboard' && method === 'GET') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      try {
        const report = adminService.summarizeDashboard(actorId);
        ok(res, report);
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    const disputeResolveMatch = path.match(/^\/admin\/disputes\/([^/]+)\/resolve$/);
    if (disputeResolveMatch && method === 'POST') {
      if (!actorId) {
        badRequest(res, 'missing-user');
        return;
      }
      const body = await parseBody(req);
      try {
        const dispute = adminService.resolveDispute(disputeResolveMatch[1], actorId, body || {});
        ok(res, { dispute });
      } catch (error) {
        badRequest(res, error.message);
      }
      return;
    }

    if (path === '/ai/listing-suggestions' && method === 'POST') {
      const body = await parseBody(req);
      const pricing = smartPricing({
        category: body.category,
        condition: body.condition,
        title: body.title
      });
      const qualityChecklist = checklist(body.condition);
      const categorySuggestion = suggestCategory(body.title || '');
      const moderation = scanListing({
        sellerId: actorId,
        title: body.title,
        description: body.description,
        tags: body.tags,
        photos: body.photos
      });
      ok(res, {
        pricing,
        qualityChecklist,
        categorySuggestion,
        moderation
      });
      return;
    }

    notFound(res);
  } catch (error) {
    serverError(res, error);
  }
}

module.exports = {
  handleApiRequest
};
