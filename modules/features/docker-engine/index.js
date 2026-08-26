import { Router } from 'express';

export default function createDockerEngineModule({ env }) {
  return {
    isConfigured: () => Boolean(env.HOSTINGER_API_TOKEN),
    navigation: [{ href: '/admin/modules/docker-engine', label: 'Docker Engine', roles: ['staff', 'admin'] }],
    async mount(app, { models, middleware, lib, audit }) {
      const router = Router();
      router.use(middleware.requireAuth, middleware.requireRole('staff', 'admin'));
      router.get('/', lib.asyncRoute(async (_req, res) => res.render('docker-engine/index.njk', { title: 'Docker Engine', projects: await models.DockerProject.find().sort('name').lean() })));
      router.post('/projects', middleware.requireRole('admin'), lib.asyncRoute(async (req, res) => { await models.DockerProject.create({ name: req.body.name, virtualMachineId: req.body.virtualMachineId, description: req.body.description, notes: req.body.notes }); res.redirect('/admin/modules/docker-engine'); }));
      router.post('/projects/:id/action', lib.asyncRoute(async (req, res) => {
        const project = await models.DockerProject.findById(req.params.id); if (!project) throw new lib.HttpError(404, 'Docker project not found');
        const action = String(req.body.action || ''); if (!['logs','start','stop','restart','update'].includes(action)) throw new lib.HttpError(400, 'Invalid Docker action');
        if (action !== 'logs' && req.user.role !== 'admin') throw new lib.HttpError(403, 'Admin access is required for infrastructure changes');
        if (!env.HOSTINGER_API_TOKEN) throw new lib.HttpError(503, 'Hostinger integration is not configured');
        const method = action === 'logs' ? 'GET' : 'POST'; const suffix = action === 'logs' ? 'logs' : action;
        const response = await fetch(`https://developers.hostinger.com/api/vps/v1/virtual-machines/${encodeURIComponent(project.virtualMachineId)}/docker/${encodeURIComponent(project.name)}/${suffix}`, { method, headers: { Authorization: `Bearer ${env.HOSTINGER_API_TOKEN}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new lib.HttpError(502, data.message || `Hostinger returned ${response.status}`);
        await audit(req, `docker_${action}`, { entityType: 'DockerProject', entityId: project._id, description: `${action} ${project.name}` });
        if (action === 'logs') return res.render('docker-engine/logs.njk', { title: `${project.name} logs`, project, logs: typeof data === 'string' ? data : JSON.stringify(data, null, 2) });
        res.redirect('/admin/modules/docker-engine');
      }));
      app.use('/admin/modules/docker-engine', router);
    }
  };
}
