import React from 'react';

const QRCodes = () => {
  const tables = Array.from({ length: 20 }, (_, i) => i + 1);

  const printAll = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header - Hidden on print */}
        <div className="no-print mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🍴 Escape Restaurant</h1>
            <p className="text-gray-600 mt-1">Table QR Codes - Scan to order</p>
          </div>
          <button 
            onClick={printAll}
            className="bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-brand-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print All QR Codes
          </button>
        </div>

        {/* QR Code Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
          {tables.map(tableNum => (
            <div 
              key={tableNum} 
              className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-200 print:shadow-none print:border print:rounded-lg print:p-4"
            >
              <div className="mb-4">
                <img 
                  src={`/qr/table_${tableNum}.png`} 
                  alt={`Table ${tableNum} QR Code`}
                  className="w-full max-w-[200px] mx-auto"
                />
              </div>
              <div className="bg-gray-900 text-white rounded-xl py-3 px-4">
                <p className="text-sm font-medium text-gray-400">TABLE</p>
                <p className="text-3xl font-bold">{tableNum}</p>
              </div>
              <p className="mt-3 text-sm text-gray-500 print:text-xs">
                Scan to view menu & order
              </p>
            </div>
          ))}
        </div>

        {/* Print Footer */}
        <div className="print-only mt-8 text-center text-gray-500 text-sm">
          <p>🍴 Escape Restaurant • Scan QR code to order from your table</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { 
            margin: 0.5in; 
          }
        }
      `}</style>
    </div>
  );
};

export default QRCodes;
