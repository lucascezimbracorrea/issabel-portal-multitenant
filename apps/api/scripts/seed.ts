import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { initSchema } from '../src/db/init.js';
import * as schema from '../src/db/schema.js';

const hash = (p: string) => bcrypt.hashSync(p, 10);

async function main() {
  await initSchema();

  await db.delete(schema.platformSettings);
  await db.delete(schema.organizationMembers);
  await db.delete(schema.callReactionDeliveryLog);
  await db.delete(schema.callReactionRules);
  await db.delete(schema.callFlows);
  await db.delete(schema.webhookDeliveries);
  await db.delete(schema.webhookEndpoints);
  await db.delete(schema.integrations);
  await db.delete(schema.extensions);
  await db.delete(schema.spaces);
  await db.delete(schema.organizations);
  await db.delete(schema.users);

  await db.insert(schema.users).values([
    {
      email: 'admin@demo.local',
      passwordHash: hash('demo123'),
      displayName: 'Platform Admin',
      role: 'platform_admin',
    },
    {
      email: 'org@demo.local',
      passwordHash: hash('demo123'),
      displayName: 'Org Admin',
      role: 'org_admin',
    },
  ]);

  const [orgUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'org@demo.local'));

  const orgIds: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const appearance = JSON.stringify({
      tradeName: 'One PBX',
      primary: '#14b8a6',
      primaryForeground: '#042f2e',
      loginLayout: 'split',
      loginTagline: 'Portal multi-empresa',
      logoUrl: `https://ui-avatars.com/api/?size=128&background=${encodeURIComponent(['0f766e', '1d4ed8', '7c3aed', 'be185d', 'b45309'][i - 1] ?? '0f766e')}&color=fff&bold=true&name=${encodeURIComponent(`C${i}`)}`,
    });
    const [insOrg] = await db
      .insert(schema.organizations)
      .values({
        name: `Cliente ${i} LTDA`,
        tradeName: `Cliente ${i}`,
        active: true,
        appearance,
        customDomain: i === 1 ? 'voice.example.com' : null,
        domainVerificationToken: i === 1 ? 'verify-token-demo' : null,
        issabelBaseUrl: null,
        orgKind: i === 1 ? 'dialer' : 'pabx',
        extensionsLimit: 50 + i * 5,
        channelsLimit: i === 1 ? 10 : 20,
        diskQuotaGb: 1 + i * 0.5,
        cdrMysql: null,
      }) as unknown as [{ insertId: number }];
    const orgId = insOrg.insertId;
    orgIds.push(orgId);
    await db.insert(schema.spaces).values([
      { organizationId: orgId, name: `Espaço A`, status: 'active' },
      { organizationId: orgId, name: `Espaço B`, status: 'active' },
    ]);
    await db.insert(schema.extensions).values([
      {
        organizationId: orgId,
        number: `${100 + i}`,
        displayName: `Ramal ${100 + i}`,
        metadata: JSON.stringify({ queue: 'suporte' }),
        source: 'portal',
      },
    ]);
  }

  if (orgUser && orgIds[0]) {
    await db.insert(schema.organizationMembers).values({
      userId: orgUser.id,
      organizationId: orgIds[0],
      role: 'org_admin',
    });
  }

  await db.insert(schema.webhookEndpoints).values({
    organizationId: orgIds[0],
    url: 'https://example.com/hook',
    secret: 'whsec_demo',
    eventTypes: JSON.stringify(['call.ended', 'whatsapp.sent']),
    enabled: true,
  });

  await db.insert(schema.integrations).values({
    organizationId: orgIds[0],
    type: 'whatsapp',
    config: JSON.stringify({ status: 'mock', phone_number_id: '123' }),
    enabled: true,
  });

  const [insFlow] = await db
    .insert(schema.callFlows)
    .values({
      organizationId: orgIds[0],
      name: 'Fluxo Atendimento',
      extensionNumber: '800',
      graphJson: JSON.stringify({ nodes: [], edges: [] }),
      version: 1,
      active: true,
    }) as unknown as [{ insertId: number }];
  const flowId = insFlow.insertId;

  const [insQueue] = await db
    .insert(schema.queues)
    .values({
      organizationId: orgIds[0],
      name: 'Atendimento',
      queueCode: '01',
      strategy: 'roundrobin',
      timeout: 30,
    }) as unknown as [{ insertId: number }];
  await db.insert(schema.queueMembers).values([
    { queueId: insQueue.insertId, agentLabel: 'Maria Silva' },
    { queueId: insQueue.insertId, agentLabel: 'Joao Santos' },
    { queueId: insQueue.insertId, agentLabel: 'Ana Costa' },
  ]);

  await db.insert(schema.callReactionRules).values([
    {
      organizationId: orgIds[0],
      eventType: 'call.ended',
      featureKey: null,
      priority: 10,
      enabled: true,
      actionKind: 'http_request',
      httpMethod: 'POST',
      urlTemplate: 'https://httpbin.org/post',
      headersTemplate: JSON.stringify({ 'Content-Type': 'application/json' }),
      bodyTemplate: JSON.stringify({ call: '{{event.unique_id}}' }),
      templateNameOrId: null,
      variableMapping: null,
      callFlowId: flowId,
      nodeId: null,
    },
  ]);

  await db.insert(schema.platformSettings).values({
    key: 'billing',
    value: JSON.stringify({ pricePerClientUsd: 39 }),
  });

  // Sample URA for org 1
  if (orgIds[0]) {
    const [insUra] = await db
      .insert(schema.uras)
      .values({
        organizationId: orgIds[0],
        name: 'Atendimento Principal',
        extensionNumber: '2000',
        repetitions: 2,
        allowDirectDial: false,
        scheduleEnabled: false,
        scheduleJson: '{}',
        dtmfActionsJson: JSON.stringify([
          { digit: '1', action: 'queue', destinationId: null },
          { digit: '2', action: 'extension', destinationId: null },
          { digit: '0', action: 'hangup', destinationId: null },
        ]),
        graphJson: JSON.stringify({ nodes: [], edges: [] }),
        version: 1,
        active: true,
      }) as unknown as [{ insertId: number }];
    const uraId = insUra.insertId;

    // Sample inbound number pointing to the URA
    await db.insert(schema.inboundNumbers).values({
      organizationId: orgIds[0],
      number: '+551140000000',
      routeType: 'ura',
      destinationId: uraId,
      maxConcurrentCalls: 10,
      registerEnabled: true,
      recordCalls: false,
      scheduleJson: '{}',
      active: true,
      description: 'Número principal demo',
    });

    // An extra inbound number with no route
    await db.insert(schema.inboundNumbers).values({
      organizationId: orgIds[0],
      number: '+551140000001',
      routeType: 'none',
      destinationId: null,
      maxConcurrentCalls: 5,
      registerEnabled: false,
      recordCalls: false,
      scheduleJson: '{}',
      active: false,
      description: 'Número secundário (inativo)',
    });
  }

  console.log('Seeded. Users: admin@demo.local / org@demo.local password: demo123');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
