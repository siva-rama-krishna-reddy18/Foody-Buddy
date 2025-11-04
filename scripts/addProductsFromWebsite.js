// backend/scripts/addProductsFromWebsite.js
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  description: String,
  image: String,
  imageUrl: String,
  category: String,
  available: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// ✅ YOUR ORIGINAL 5 PRODUCTS
const originalProducts = [
  { 
    name: "Soup", 
    price: "13.08", 
    description: "Delicious homemade soup", 
    category: "Soups", 
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop" 
  },
  { 
    name: "Chicken Fry (Boneless) Halal 16 Oz", 
    price: "14.00", 
    description: "Crispy fried chicken pieces - Halal certified", 
    category: "Main Course", 
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop" 
  },
  { 
    name: "Chicken Fried Rice (32 Oz)", 
    price: "13.00", 
    description: "Fried rice with chicken and vegetables", 
    category: "Rice", 
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop" 
  },
  { 
    name: "Fried Rice", 
    price: "10.00", 
    description: "Classic vegetable fried rice", 
    category: "Rice", 
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop" 
  },
  { 
    name: "Fried Rice", 
    price: "10.00", 
    description: "Classic fried rice with egg", 
    category: "Rice", 
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop" 
  }
];

// ✅ NEW INDIAN FOOD PRODUCTS
const indianFoodProducts = [
  // Appetizers
  { name: "Samosa (2 Pcs)", price: "4.99", description: "Crispy pastry filled with spiced potatoes and peas", category: "Appetizers", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop" },
  { name: "Pakora", price: "6.99", description: "Mixed vegetable fritters with chickpea flour", category: "Appetizers", image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&h=300&fit=crop" },
  { name: "Paneer Tikka", price: "12.99", description: "Grilled cottage cheese with spices", category: "Appetizers", image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop" },
  { name: "Chicken 65", price: "13.99", description: "Spicy fried chicken appetizer", category: "Appetizers", image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&h=300&fit=crop" },
  
  // Main Course - Vegetarian
  { name: "Palak Paneer", price: "13.99", description: "Cottage cheese in spinach gravy", category: "Main Course", image: "https://images.unsplash.com/photo-1645177628172-a94c30a5e3ae?w=400&h=300&fit=crop" },
  { name: "Paneer Butter Masala", price: "14.99", description: "Cottage cheese in rich tomato butter sauce", category: "Main Course", image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop" },
  { name: "Dal Makhani", price: "11.99", description: "Black lentils in creamy tomato sauce", category: "Main Course", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop" },
  { name: "Chana Masala", price: "11.99", description: "Chickpeas in spiced tomato gravy", category: "Main Course", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop" },
  { name: "Aloo Gobi", price: "12.99", description: "Potato and cauliflower curry", category: "Main Course", image: "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=400&h=300&fit=crop" },
  { name: "Vegetable Korma", price: "13.99", description: "Mixed vegetables in creamy cashew sauce", category: "Main Course", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop" },
  
  // Main Course - Non-Vegetarian
  { name: "Butter Chicken", price: "15.99", description: "Tender chicken in creamy tomato butter sauce", category: "Main Course", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop" },
  { name: "Chicken Tikka Masala", price: "15.99", description: "Grilled chicken in spiced tomato gravy", category: "Main Course", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop" },
  { name: "Chicken Curry", price: "14.99", description: "Traditional chicken curry with spices", category: "Main Course", image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop" },
  { name: "Chicken Vindaloo", price: "15.99", description: "Spicy chicken curry with vinegar and potatoes", category: "Main Course", image: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop" },
  { name: "Lamb Rogan Josh", price: "17.99", description: "Tender lamb in aromatic spiced gravy", category: "Main Course", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop" },
  { name: "Fish Curry", price: "16.99", description: "Fish in coconut-based curry sauce", category: "Main Course", image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400&h=300&fit=crop" },
  
  // Biryani
  { name: "Vegetable Biryani", price: "13.99", description: "Fragrant basmati rice with mixed vegetables", category: "Biryani", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop" },
  { name: "Chicken Biryani", price: "15.99", description: "Aromatic basmati rice with spiced chicken", category: "Biryani", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop" },
  { name: "Lamb Biryani", price: "17.99", description: "Basmati rice with tender lamb pieces", category: "Biryani", image: "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=400&h=300&fit=crop" },
  { name: "Shrimp Biryani", price: "18.99", description: "Fragrant rice with marinated shrimp", category: "Biryani", image: "https://images.unsplash.com/photo-1633945274309-2c6d6d5d9e6a?w=400&h=300&fit=crop" },
  
  // Bread
  { name: "Naan", price: "2.99", description: "Traditional Indian flatbread", category: "Bread", image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop" },
  { name: "Garlic Naan", price: "3.49", description: "Naan topped with fresh garlic", category: "Bread", image: "https://images.unsplash.com/photo-1619897373122-ff4fd6d1e8f1?w=400&h=300&fit=crop" },
  { name: "Butter Naan", price: "3.49", description: "Naan brushed with butter", category: "Bread", image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop" },
  { name: "Roti", price: "2.49", description: "Whole wheat Indian flatbread", category: "Bread", image: "https://images.unsplash.com/photo-1619897373122-ff4fd6d1e8f1?w=400&h=300&fit=crop" },
  { name: "Paratha", price: "3.99", description: "Layered flatbread", category: "Bread", image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop" },
  
  // Desserts
  { name: "Gulab Jamun (3 Pcs)", price: "5.99", description: "Sweet milk dumplings in sugar syrup", category: "Desserts", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop" },
  { name: "Rasmalai (2 Pcs)", price: "6.99", description: "Cottage cheese dumplings in sweet milk", category: "Desserts", image: "https://images.unsplash.com/photo-1631636804322-d0c4c9a6f0c1?w=400&h=300&fit=crop" },
  { name: "Kheer", price: "5.99", description: "Traditional rice pudding", category: "Desserts", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
  { name: "Kulfi", price: "4.99", description: "Indian ice cream with cardamom", category: "Desserts", image: "https://images.unsplash.com/photo-1596450514735-b1e6c632e97a?w=400&h=300&fit=crop" },
  
  // Drinks
  { name: "Mango Lassi", price: "4.99", description: "Sweet mango yogurt drink", category: "Drinks", image: "https://images.unsplash.com/photo-1589374871450-b3a09e35deec?w=400&h=300&fit=crop" },
  { name: "Sweet Lassi", price: "3.99", description: "Sweet yogurt drink", category: "Drinks", image: "https://images.unsplash.com/photo-1564759224907-65b945e7e9f1?w=400&h=300&fit=crop" },
  { name: "Masala Chai", price: "2.99", description: "Spiced Indian tea", category: "Drinks", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=300&fit=crop" },
  { name: "Mango Juice", price: "3.99", description: "Fresh mango juice", category: "Drinks", image: "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop" },
];

// ✅ COMBINE BOTH LISTS
const allProducts = [...originalProducts, ...indianFoodProducts];

async function addProducts() {
  try {
    console.log('🚀 Starting to add products...');
    console.log(`📦 Will add ${allProducts.length} products total\n`);
    console.log(`   - ${originalProducts.length} original products`);
    console.log(`   - ${indianFoodProducts.length} new Indian food products\n`);
    
    // Clear existing products
    const deleteResult = await Product.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing products\n`);
    
    let added = 0;
    
    for (const productData of allProducts) {
      const product = new Product({
        ...productData,
        imageUrl: productData.image,
        available: true
      });
      
      await product.save();
      console.log(`✅ Added: ${product.name.padEnd(40)} - $${product.price.padStart(6)} (${product.category})`);
      added++;
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Added: ${added} products`);
    console.log(`📦 Total in database: ${await Product.countDocuments()}`);
    console.log('\n🎉 Done! Now run: node scripts/addEmbeddings.js');
    
    mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

addProducts();