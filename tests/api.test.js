const request = require('supertest');
const app = require('../server');

describe('API Bugs Tests', () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    // Reset data before each test
    await agent.post('/api/reset');
  });

  // Bug 1: POST /api/invoices - wrong-arithmetic
  test('1. GST should be 0 for SEZ invoices', async () => {
    const res = await agent
      .post('/api/invoices')
      .send({
        candidateName: 'SEZ Company',
        isSez: true,
        items: [{ desc: 'Service', qty: 2, rate: 250 }] // Subtotal = 500
      });
    
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(500);
    expect(res.body.gst).toBe(0); // Should be 0, not 90
    expect(res.body.total).toBe(500);
  });

  // Bug 2: POST /api/invoices/:id/credit-note - missing-boundary-check
  test('2. Credit note rejected if balance becomes negative', async () => {
    // Invoice 3 has balance 1270 initially. Bring it to 0.
    await agent
      .post('/api/invoices/3/credit-note')
      .send({ amount: 1270 });

    // Now balance is 0. Try to apply 1 more.
    const res = await agent
      .post('/api/invoices/3/credit-note')
      .send({ amount: 1 });
    
    expect(res.status).toBe(400); // Should be rejected since balance is 0
  });

  // Bug 3: POST /api/invoices - type-coercion
  test('3. qty as a string should be rejected with HTTP 400', async () => {
    const res = await agent
      .post('/api/invoices')
      .send({
        candidateName: 'Test Corp',
        isSez: false,
        items: [{ desc: 'Item', qty: "3", rate: 250 }]
      });
    
    expect(res.status).toBe(400);
  });

  // Bug 4: POST /api/invoices - missing-boundary-check
  test('4. qty of 0 should be rejected with HTTP 400', async () => {
    const res = await agent
      .post('/api/invoices')
      .send({
        candidateName: 'Test Corp',
        isSez: false,
        items: [{ desc: 'Item', qty: 0, rate: 250 }]
      });
    
    expect(res.status).toBe(400);
  });

  // Bug 5: GET /api/invoices - stale-or-mismatched-aggregate
  test('5. Total should match between list and detail endpoints', async () => {
    const detailRes = await agent.get('/api/invoices/1');
    expect(detailRes.status).toBe(200);
    const detailTotal = detailRes.body.total; // 1829

    const listRes = await agent.get('/api/invoices');
    expect(listRes.status).toBe(200);
    
    const invoice1InList = listRes.body.find(inv => inv.id === 1);
    expect(invoice1InList.total).toBe(detailTotal); // Should be 1829, not 1550
  });

  // Bug 6: POST /api/invoices/:id/credit-note - wrong-status-code
  test('6. Applying credit note to nonexistent invoice returns 404', async () => {
    const res = await agent
      .post('/api/invoices/9999/credit-note')
      .send({ amount: 100 });
    
    expect(res.status).toBe(404); // Should be 404, not 200
  });
});
