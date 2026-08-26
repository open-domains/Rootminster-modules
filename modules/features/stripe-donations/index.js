import { Router, raw } from 'express';
import Stripe from 'stripe';

export default function createStripeDonationsModule({ env }) {
  const configured = () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  return {
    isConfigured: configured,
    navigation: [{ href: '/settings/donations', label: 'Donations', roles: ['user','staff','admin'] }],
    jobs: [{ name: 'stripe-donations: cleanup pending donations', every: 6 * 3600000, run: async () => { const { Donation } = await import('../../../src/models/index.js'); return Donation.deleteMany({ status: 'pending', createdAt: { $lt: new Date(Date.now() - 48 * 3600000) } }); } }],
    async mountRaw(app, { models, lib }) {
      app.post('/webhooks/stripe', raw({ type: 'application/json' }), lib.asyncRoute(async (req, res) => {
        if (!configured()) throw new lib.HttpError(503, 'Stripe donations are not configured');
        let event; try { event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET); } catch (error) { throw new lib.HttpError(400, `Webhook error: ${error.message}`); }
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object; const donation = await models.Donation.findById(session.metadata?.donation_id);
          if (donation && donation.status !== 'succeeded') { donation.status = 'succeeded'; donation.stripePaymentIntentId = String(session.payment_intent || ''); await donation.save(); const total = (await models.Donation.aggregate([{ $match: { userEmail: donation.userEmail, status: 'succeeded' } }, { $group: { _id: null, total: { $sum: '$amountPence' } } }]))[0]?.total || 0; if (total >= Number(env.NS_UNLOCK_THRESHOLD_PENCE || 200)) { donation.nsUnlockGranted = true; await donation.save(); await models.User.findByIdAndUpdate(donation.user, { nsUnlocked: true }); } await models.AuditLog.create({ actorEmail: donation.userEmail, actorRole: 'user', action: 'donation_succeeded', entityType: 'Donation', entityId: String(donation._id), description: `Donation of £${(donation.amountPence / 100).toFixed(2)} received` }); }
        }
        res.json({ received: true });
      }));
    },
    async mount(app, { models, middleware, lib, config }) {
      const router = Router(); router.use(middleware.requireAuth);
      router.get('/', lib.asyncRoute(async (req, res) => res.render('stripe-donations/index.njk', { title: 'Donations', donations: await models.Donation.find({ user: req.user._id }).sort('-createdAt').lean(), configured: configured(), threshold: Number(env.NS_UNLOCK_THRESHOLD_PENCE || 200) })));
      router.post('/', lib.asyncRoute(async (req, res) => { if (!configured()) throw new lib.HttpError(503, 'Stripe donations are not configured'); const amountPence = Number(req.body.amountPence || 200); if (amountPence < 50) throw new lib.HttpError(400, 'Minimum donation is 50p'); const donation = await models.Donation.create({ user: req.user._id, userEmail: req.user.email, amountPence, status: 'pending' }); const session = await stripe.checkout.sessions.create({ mode: 'payment', customer_email: req.user.email, line_items: [{ price_data: { currency: 'gbp', unit_amount: amountPence, product_data: { name: 'Open Domains donation', description: 'Support the platform and unlock NS records after reaching the configured total.' } }, quantity: 1 }], metadata: { donation_id: String(donation._id), user_id: String(req.user._id), user_email: req.user.email }, success_url: `${config.APP_URL}/settings/donations?donation=success`, cancel_url: `${config.APP_URL}/settings/donations?donation=cancelled` }); donation.stripeSessionId = session.id; await donation.save(); res.redirect(303, session.url); }));
      app.use('/settings/donations', router);
    }
  };
}
