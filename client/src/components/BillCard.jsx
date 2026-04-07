import React from 'react';

const BillCard = ({ bill }) => {
  const { order, subtotal, tax, discount, total } = bill;

  return (
    <div className="card p-6 bg-white w-full max-w-sm mx-auto font-mono text-sm relative print-only:max-w-none print-only:shadow-none print-only:border-none print-only:p-0">
      <div className="absolute top-0 right-0 p-4 no-print">
        {bill.isPaid ? (
          <span className="text-green-600 font-bold border-2 border-green-600 rounded px-2 py-1 transform rotate-12 inline-block">PAID</span>
        ) : (
          <span className="text-red-600 font-bold border-2 border-red-600 rounded px-2 py-1 transform -rotate-12 inline-block">UNPAID</span>
        )}
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold font-sans uppercase tracking-widest text-gray-900">ESC</h2>
        <p className="text-xs text-gray-500 mt-1">RESTAURANT & BAR</p>
        <p className="text-xs text-gray-500 mt-2">123 Culinary Hub, Food Street</p>
        <p className="text-xs text-gray-500">GSTIN: 22AAAAA0000A1Z5</p>
        
        <div className="border-t border-b border-dashed border-gray-300 py-2 mt-4 space-y-1">
          <div className="flex justify-between">
            <span>Bill No: #{bill.id.toString().padStart(4, '0')}</span>
            <span>Table: {order.table.tableNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date: {new Date(bill.createdAt).toLocaleDateString('en-IN')}</span>
            <span>Time: {new Date(bill.createdAt).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between font-bold text-gray-800 border-b border-gray-200 pb-2">
          <span className="w-8">Qty</span>
          <span className="flex-1">Item</span>
          <span className="w-16 text-right">Amount</span>
        </div>
        
        {order.items.map((item) => {
          if (item.itemStatus === 'SKIPPED' || item.itemStatus === 'OUT_OF_STOCK') return null;
          return (
            <div key={item.id} className="flex justify-between text-gray-700">
              <span className="w-8">{item.quantity}</span>
              <span className="flex-1 pr-2 truncate">{item.menuItem.name}</span>
              <span className="w-16 text-right">{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-gray-300 pt-4 space-y-2 mb-6">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-₹{discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>CGST (2.5%)</span>
          <span>₹{(tax / 2).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>SGST (2.5%)</span>
          <span>₹{(tax / 2).toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-800 pt-2 mt-2">
          <span>TOTAL</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-4">
        <p>Thank you for dining with us!</p>
        <p className="mt-1">Visit again: escape-restaurant.com</p>
      </div>
    </div>
  );
};

export default BillCard;
