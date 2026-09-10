const GST_RATE = 0.18;

function makeSeed() {
  const invoices = [
    {
      id: 1,
      candidateName: 'Acme Corp - batch 1',
      isSez: false,
      items: [
        { desc: 'Identity Check', qty: 3, rate: 250 },
        { desc: 'Education Check', qty: 2, rate: 400 }
      ],
      subtotal: 1550,
      gst: 279,
      total: 1829,
      balance: 1829,
      status: 'INVOICE_ISSUED',
      creditNotes: []
    },
    {
      id: 2,
      candidateName: 'Widget Co - batch A (SEZ)',
      isSez: true,
      items: [
        { desc: 'Employment Check', qty: 5, rate: 600 }
      ],
      subtotal: 3000,
      gst: 0,
      total: 3000,
      balance: 3000,
      status: 'INVOICE_ISSUED',
      creditNotes: []
    },
    {
      id: 3,
      candidateName: 'Thirdplace Inc',
      isSez: false,
      items: [
        { desc: 'Address Check', qty: 10, rate: 150 }
      ],
      subtotal: 1500,
      gst: 270,
      total: 1770,
      balance: 1270,
      status: 'INVOICE_ISSUED',
      creditNotes: [
        { id: 1, amount: 500, date: '2026-06-01' }
      ]
    }
  ];

  return { invoices, nextId: 4, nextCreditNoteId: 3 };
}

module.exports = { GST_RATE, makeSeed };
