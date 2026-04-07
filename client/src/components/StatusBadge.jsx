import React from 'react';

const StatusBadge = ({ status, type = 'item' }) => {
  let styles = 'bg-zinc-800 text-zinc-400';
  let label = status;

  if (type === 'item') {
    switch (status) {
      case 'PENDING':
        styles = 'bg-zinc-800 text-zinc-400';
        label = 'Pending';
        break;
      case 'PREPARING':
        styles = 'bg-amber-500/20 text-amber-400';
        label = 'Preparing';
        break;
      case 'DONE':
        styles = 'bg-emerald-500/20 text-emerald-400';
        label = 'Ready';
        break;
      case 'OUT_OF_STOCK':
        styles = 'bg-red-500/20 text-red-400';
        label = 'Unavailable';
        break;
      case 'SKIPPED':
        styles = 'bg-zinc-800 text-zinc-500';
        label = 'Skipped';
        break;
    }
  } else if (type === 'order') {
    switch (status) {
      case 'PENDING':
        styles = 'bg-blue-500/20 text-blue-400';
        label = 'Confirmed';
        break;
      case 'IN_PROGRESS':
        styles = 'bg-amber-500/20 text-amber-400';
        label = 'Preparing';
        break;
      case 'PARTIALLY_READY':
        styles = 'bg-yellow-500/20 text-yellow-400';
        label = 'Partial';
        break;
      case 'COMPLETED':
        styles = 'bg-emerald-500/20 text-emerald-400';
        label = 'Ready';
        break;
      case 'BILLED':
        styles = 'bg-purple-500/20 text-purple-400';
        label = 'Billed';
        break;
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
