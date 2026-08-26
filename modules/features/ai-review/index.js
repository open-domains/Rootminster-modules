import { Router } from 'express';
import mongoose from 'mongoose';

const AiReview = mongoose.models.ModuleAiReview || mongoose.model('ModuleAiReview', new mongoose.Schema({ request: { type: mongoose.Schema.Types.ObjectId, ref: 'SubdomainRequest', required: true, index: true }, decision: { type: String, enum: ['approve','reject','needs_info'], required: true }, rejectionReason: String, question: String, adminNotes: String, model: String, status: { type: String, enum: ['pending','dismissed'], default: 'pending' }, raw: mongoose.Schema.Types.Mixed }, { timestamps: true }));

export default function createAiReviewModule({ env }) {
  const configured = () => Boolean(env.AI_API_KEY && env.AI_MODEL);
  async function review(request) {
    const deterministic = preflight(request); if (deterministic) return deterministic;
    const endpoint = `${String(env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.AI_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Review free subdomain requests. Return JSON with decision (approve, reject, or needs_info), rejectionReason, question, and adminNotes. Never apply an action. Reject abuse, phishing, malware, commercial financial schemes, adult content, gambling, hate, or mismatched DNS. Legitimate personal, educational, hobby, and open-source projects are allowed.' }, { role: 'user', content: JSON.stringify({ subdomain: request.fullName, recordType: request.recordType, recordValue: request.recordValue, description: request.reason, previewLink: request.previewLink }) }] }), signal: AbortSignal.timeout(45000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || `AI provider returned ${response.status}`);
    const content = data.choices?.[0]?.message?.content; if (!content) throw new Error('AI provider returned no review');
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '')); if (!['approve','reject','needs_info'].includes(parsed.decision)) throw new Error('AI provider returned an invalid decision');
    return { decision: parsed.decision, rejectionReason: parsed.rejectionReason, question: parsed.question, adminNotes: parsed.adminNotes, raw: data };
  }
  return {
    isConfigured: configured,
    navigation: [{ href: '/admin/modules/ai-review', label: 'AI Review', roles: ['admin'] }],
    models: { AiReview },
    async mount(app, { models, middleware, lib, audit }) {
      const router = Router(); router.use(middleware.requireAuth, middleware.requireRole('admin'));
      router.get('/', lib.asyncRoute(async (_req, res) => res.render('ai-review/index.njk', { title: 'AI Review', reviews: await AiReview.find().populate('request').sort('-createdAt').limit(100).lean(), pendingCount: await models.SubdomainRequest.countDocuments({ status: { $in: ['pending','user_responded'] } }), configured: configured() })));
      router.post('/run', lib.asyncRoute(async (req, res) => { if (!configured()) throw new lib.HttpError(503, 'AI Review is not configured'); const requests = await models.SubdomainRequest.find({ status: { $in: ['pending','user_responded'] } }).limit(100); let reviewed = 0; for (const request of requests) { const result = await review(request); await AiReview.findOneAndUpdate({ request: request._id, status: 'pending' }, { request: request._id, model: env.AI_MODEL, ...result }, { upsert: true, new: true, setDefaultsOnInsert: true }); reviewed += 1; } await audit(req, 'ai_review_run', { entityType: 'ModuleAiReview', description: `Generated ${reviewed} advisory suggestions` }); res.redirect('/admin/modules/ai-review'); }));
      router.post('/:id/dismiss', lib.asyncRoute(async (req, res) => { await AiReview.findByIdAndUpdate(req.params.id, { status: 'dismissed' }); res.redirect('/admin/modules/ai-review'); }));
      app.use('/admin/modules/ai-review', router);
    }
  };
}

function preflight(request) {
  const name = String(request.subdomain || '').toLowerCase(); const reason = String(request.reason || ''); const url = String(request.previewLink || '');
  if (/^(test|asdf|foo|bar|qwerty|dummy|placeholder)$/i.test(name)) return { decision: 'reject', rejectionReason: 'The name appears to be a test or placeholder.', adminNotes: 'Deterministic preflight rule.' };
  try { const parsed = new URL(url); if (!['http:','https:'].includes(parsed.protocol) || /^(localhost|127\.|10\.|192\.168\.)/.test(parsed.hostname)) return { decision: 'reject', rejectionReason: 'A public project preview URL is required.', adminNotes: 'Deterministic preflight rule.' }; } catch { return { decision: 'needs_info', question: 'Please provide a valid public project preview URL.', adminNotes: 'Preview URL missing or invalid.' }; }
  if (reason.trim().split(/\s+/).length < 5 && !/portfolio|personal (site|website)/i.test(reason)) return { decision: 'needs_info', question: 'Please explain what the project does and who it is for.', adminNotes: 'Description is too brief.' };
  return null;
}
