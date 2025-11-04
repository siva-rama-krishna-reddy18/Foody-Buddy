// src/tools/langchainTools.js
const { Tool } = require("langchain/tools");

// Export all tools for better organization
module.exports = {
  MenuSearchTool: require('./menuSearchTool'),
  CartTool: require('./cartTool'),
  OrderTool: require('./orderTool'),
  ProductInfoTool: require('./productInfoTool')
};