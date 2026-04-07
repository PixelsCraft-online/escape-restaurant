const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create 20 tables
  for (let i = 1; i <= 20; i++) {
    await prisma.table.upsert({
      where: { tableNumber: i },
      update: {},
      create: {
        tableNumber: i,
        qrCode: `https://escape-restaurant.vercel.app/menu?table=${i}`,
        isOccupied: false,
      },
    });
  }
  console.log('✅ 20 tables created');

  // Menu items
  const menuItems = [
    // STARTERS
    { name: 'Paneer Tikka', category: 'STARTER', price: 220, isVeg: true, imageUrl: null },
    { name: 'Chicken Tikka', category: 'STARTER', price: 280, isVeg: false, imageUrl: null },
    { name: 'Veg Spring Rolls', category: 'STARTER', price: 160, isVeg: true, imageUrl: null },
    { name: 'Fish Amritsari', category: 'STARTER', price: 320, isVeg: false, imageUrl: null },
    { name: 'Hara Bhara Kabab', category: 'STARTER', price: 180, isVeg: true, imageUrl: null },

    // MAIN VEG
    { name: 'Paneer Butter Masala', category: 'MAIN_VEG', price: 260, isVeg: true, imageUrl: null },
    { name: 'Dal Makhani', category: 'MAIN_VEG', price: 220, isVeg: true, imageUrl: null },
    { name: 'Palak Paneer', category: 'MAIN_VEG', price: 240, isVeg: true, imageUrl: null },
    { name: 'Chana Masala', category: 'MAIN_VEG', price: 200, isVeg: true, imageUrl: null },
    { name: 'Mixed Veg Curry', category: 'MAIN_VEG', price: 210, isVeg: true, imageUrl: null },

    // MAIN NON-VEG
    { name: 'Chicken Biryani', category: 'MAIN_NONVEG', price: 320, isVeg: false, imageUrl: null },
    { name: 'Mutton Rogan Josh', category: 'MAIN_NONVEG', price: 480, isVeg: false, imageUrl: null },
    { name: 'Butter Chicken', category: 'MAIN_NONVEG', price: 340, isVeg: false, imageUrl: null },
    { name: 'Fish Curry', category: 'MAIN_NONVEG', price: 360, isVeg: false, imageUrl: null },
    { name: 'Prawn Masala', category: 'MAIN_NONVEG', price: 420, isVeg: false, imageUrl: null },

    // BREAD & RICE
    { name: 'Butter Naan', category: 'BREAD_RICE', price: 40, isVeg: true, imageUrl: null },
    { name: 'Tandoori Roti', category: 'BREAD_RICE', price: 30, isVeg: true, imageUrl: null },
    { name: 'Laccha Paratha', category: 'BREAD_RICE', price: 50, isVeg: true, imageUrl: null },
    { name: 'Steamed Rice', category: 'BREAD_RICE', price: 80, isVeg: true, imageUrl: null },
    { name: 'Garlic Naan', category: 'BREAD_RICE', price: 50, isVeg: true, imageUrl: null },

    // DESSERT
    { name: 'Gulab Jamun', category: 'DESSERT', price: 80, isVeg: true, imageUrl: null },
    { name: 'Rasgulla', category: 'DESSERT', price: 80, isVeg: true, imageUrl: null },
    { name: 'Kheer', category: 'DESSERT', price: 100, isVeg: true, imageUrl: null },
    { name: 'Kulfi Falooda', category: 'DESSERT', price: 120, isVeg: true, imageUrl: null },
    { name: 'Chocolate Brownie', category: 'DESSERT', price: 150, isVeg: true, imageUrl: null },

    // BEVERAGES
    { name: 'Masala Chai', category: 'BEVERAGE', price: 30, isVeg: true, imageUrl: null },
    { name: 'Fresh Lime Soda', category: 'BEVERAGE', price: 60, isVeg: true, imageUrl: null },
    { name: 'Mango Lassi', category: 'BEVERAGE', price: 90, isVeg: true, imageUrl: null },
    { name: 'Cold Coffee', category: 'BEVERAGE', price: 120, isVeg: true, imageUrl: null },
    { name: 'Mineral Water', category: 'BEVERAGE', price: 30, isVeg: true, imageUrl: null },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({ data: item });
  }
  console.log('✅ 30 menu items created');

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
