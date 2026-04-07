function registerSocketEvents(io, prisma, redis) {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    socket.data.isAdmin = false;

    // Join room based on role/table
    socket.on('join_table', ({ tableNumber }) => {
      socket.join(`table_${tableNumber}`);
      console.log(`📍 Socket ${socket.id} joined table_${tableNumber}`);
    });

    socket.on('join_staff', ({ pin }) => {
      if (pin === process.env.ADMIN_PIN) {
        socket.data.isAdmin = true;
        socket.join('staff');
        console.log(`👨‍🍳 Socket ${socket.id} joined staff`);
      } else {
        socket.emit('error', { message: 'Unauthorized' });
      }
    });

    socket.on('join_admin', ({ pin }) => {
      if (pin === process.env.ADMIN_PIN) {
        socket.data.isAdmin = true;
        socket.join('admin');
        console.log(`🔑 Socket ${socket.id} joined admin`);
      } else {
        socket.emit('error', { message: 'Unauthorized' });
      }
    });

    // Place order via socket
    socket.on('place_order', async ({ tableId, items }) => {
      try {
        if (!items || items.some(i => i.quantity <= 0 || !Number.isInteger(i.quantity))) {
          return socket.emit('error', { message: 'Invalid items or quantity' });
        }

        const menuItemIds = items.map((i) => i.menuItemId);
        const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, isAvailable: true } });
        
        if (menuItems.length !== menuItemIds.length) {
          return socket.emit('error', { message: 'One or more items are invalid or unavailable' });
        }
        
        const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, m.price]));

        const order = await prisma.order.create({
          data: {
            tableId,
            status: 'PENDING',
            items: {
              create: items.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: priceMap[item.menuItemId],
                itemStatus: 'PENDING',
              })),
            },
          },
          include: { items: { include: { menuItem: true } }, table: true },
        });

        await prisma.table.update({ where: { id: tableId }, data: { isOccupied: true } });

        io.to('staff').emit('new_order', order);
        io.to('admin').emit('new_order', order);
        socket.emit('order_placed', order);
      } catch (err) {
        console.error('place_order error:', err);
        socket.emit('error', { message: 'Failed to place order' });
      }
    });

    // Add items to existing order
    socket.on('add_items', async ({ orderId, items }) => {
      try {
        if (!items || items.some(i => i.quantity <= 0 || !Number.isInteger(i.quantity))) {
          return socket.emit('error', { message: 'Invalid items or quantity' });
        }

        const menuItemIds = items.map((i) => i.menuItemId);
        const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, isAvailable: true } });
        
        if (menuItems.length !== menuItemIds.length) {
          return socket.emit('error', { message: 'One or more items are invalid or unavailable' });
        }
        
        const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, m.price]));

        await Promise.all(
          items.map((item) =>
            prisma.orderItem.create({
              data: {
                orderId,
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: priceMap[item.menuItemId],
                itemStatus: 'PENDING',
              },
            })
          )
        );

        const updatedOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: { include: { menuItem: true } }, table: true },
        });

        io.to('staff').emit('order_updated', updatedOrder);
        socket.emit('items_added', updatedOrder);
      } catch (err) {
        console.error('add_items error:', err);
      }
    });

    // Item action from kitchen: DONE, SKIP, OOS
    socket.on('item_action', async ({ orderItemId, action }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      const actionMap = { DONE: 'DONE', SKIP: 'SKIPPED', OOS: 'OUT_OF_STOCK' };
      const itemStatus = actionMap[action];
      if (!itemStatus) return;

      try {
        const orderItem = await prisma.orderItem.update({
          where: { id: orderItemId },
          data: { itemStatus },
          include: { menuItem: true, order: { include: { table: true } } },
        });

        const tableNumber = orderItem.order.table.tableNumber;
        io.to(`table_${tableNumber}`).emit('item_status_update', { orderItem });
        io.to('staff').emit('item_status_update', { orderItem });

        // Auto-update order status
        const allItems = await prisma.orderItem.findMany({ where: { orderId: orderItem.orderId } });
        const terminal = ['DONE', 'SKIPPED', 'OUT_OF_STOCK'];
        const allFinished = allItems.every((i) => terminal.includes(i.itemStatus));

        if (allFinished) {
          const allDone = allItems.every((i) => i.itemStatus === 'DONE');
          await prisma.order.update({
            where: { id: orderItem.orderId },
            data: { status: allDone ? 'COMPLETED' : 'PARTIALLY_READY' },
          });
        }
      } catch (err) {
        console.error('item_action error:', err);
      }
    });

    // Mark order as delivered
    socket.on('mark_delivered', async ({ orderId }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED' },
          include: { items: { include: { menuItem: true } }, table: true },
        });

        io.to('staff').emit('order_completed', order);
        io.to(`table_${order.table.tableNumber}`).emit('order_completed', order);
      } catch (err) {
        console.error('mark_delivered error:', err);
      }
    });

    // Generate bill via socket
    socket.on('generate_bill', async ({ orderId, discount, discountType }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: { include: { menuItem: true } }, table: true },
        });

        // Only charge for items that were actually served (exclude OUT_OF_STOCK and SKIPPED)
        const chargeableItems = order.items.filter(
          item => item.itemStatus !== 'OUT_OF_STOCK' && item.itemStatus !== 'SKIPPED'
        );
        
        const subtotal = chargeableItems.reduce((s, i) => s + i.price * i.quantity, 0);
        let discountAmount = 0;
        if (discountType === 'percent') discountAmount = (subtotal * (discount || 0)) / 100;
        else discountAmount = discount || 0;

        const taxable = subtotal - discountAmount;
        const tax = parseFloat((taxable * 0.05).toFixed(2));
        const total = parseFloat((taxable + tax).toFixed(2));

        const existing = await prisma.bill.findUnique({ where: { orderId } });
        let bill;
        if (existing) {
          bill = existing;
        } else {
          bill = await prisma.bill.create({
            data: {
              orderId,
              tableId: order.tableId,
              subtotal: parseFloat(subtotal.toFixed(2)),
              tax,
              discount: parseFloat(discountAmount.toFixed(2)),
              total,
            },
            include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
          });
          await prisma.order.update({ where: { id: orderId }, data: { status: 'BILLED' } });
        }

        io.to('staff').emit('bill_generated', bill);
        io.to(`table_${order.table.tableNumber}`).emit('bill_generated', bill);
      } catch (err) {
        console.error('generate_bill error:', err);
      }
    });

    // Mark bill paid via socket
    socket.on('mark_paid', async ({ billId }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const bill = await prisma.bill.update({
          where: { id: billId },
          data: { isPaid: true, paidAt: new Date() },
          include: { order: { include: { table: true } } },
        });
        
        const tableNumber = bill.order.table.tableNumber;
        
        // Free up the table
        await prisma.table.update({ where: { id: bill.tableId }, data: { isOccupied: false } });
        
        // Deactivate any active sessions for this table
        await prisma.tableSession.updateMany({
          where: { tableNumber, isActive: true },
          data: { isActive: false }
        });
        
        io.to('staff').emit('bill_paid', bill);
        io.to('admin').emit('bill_paid', bill);
        
        // Notify customer that session has ended
        io.to(`table_${tableNumber}`).emit('bill_paid', bill);
        io.to(`table_${tableNumber}`).emit('session_ended', { 
          tableNumber, 
          message: 'Thank you for dining with us! Your session has ended.' 
        });
      } catch (err) {
        console.error('mark_paid error:', err);
      }
    });

    // Toggle menu item availability
    socket.on('toggle_menu_item', async ({ menuItemId, isAvailable }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        await prisma.menuItem.update({ where: { id: menuItemId }, data: { isAvailable } });
        await redis.del('menu:all').catch(() => {});
        const items = await prisma.menuItem.findMany({ orderBy: { category: 'asc' } });
        await redis.setex('menu:all', 300, JSON.stringify(items)).catch(() => {});
        io.emit('menu_item_toggled', { menuItemId, isAvailable });
      } catch (err) {
        console.error('toggle_menu_item error:', err);
      }
    });

    // Call waiter from customer
    socket.on('call_waiter', async ({ tableId, tableNumber }) => {
      try {
        const call = await prisma.waiterCall.create({
          data: { tableId },
          include: { table: true }
        });
        
        io.to('staff').emit('waiter_called', { 
          id: call.id,
          tableNumber, 
          tableId,
          createdAt: call.createdAt 
        });
        console.log(`🙋 Waiter called for table ${tableNumber}`);
      } catch (err) {
        console.error('call_waiter error:', err);
      }
    });

    // Acknowledge waiter call from counter/staff
    socket.on('acknowledge_waiter_call', async ({ callId, tableNumber }) => {
      if (!socket.data.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        await prisma.waiterCall.update({
          where: { id: callId },
          data: { isAttended: true, attendedAt: new Date() }
        });
        
        io.to(`table_${tableNumber}`).emit('waiter_acknowledged');
        io.to('staff').emit('waiter_call_handled', { callId });
        console.log(`✅ Waiter call ${callId} acknowledged for table ${tableNumber}`);
      } catch (err) {
        console.error('acknowledge_waiter_call error:', err);
      }
    });

    // Request bill from customer
    socket.on('request_bill', async ({ tableId, tableNumber, orderIds }) => {
      try {
        io.to('staff').emit('bill_requested', { 
          tableNumber, 
          tableId,
          orderIds,
          createdAt: new Date()
        });
        console.log(`💵 Bill requested for table ${tableNumber}`);
      } catch (err) {
        console.error('request_bill error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
}

module.exports = registerSocketEvents;
