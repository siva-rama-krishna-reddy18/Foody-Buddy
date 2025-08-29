// const messageService = require('../services/messageService');

// class MessageController {
//     async updateMessage(req, res, next) {
//         const { messageId } = req.params;
//         const { content, customerId, metadata } = req.body;

//         if (!content || !customerId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Content and customer ID are required'
//             });
//         }

//         try {
//             const updatedMessage = await messageService.updateMessage(
//                 messageId,
//                 content,
//                 customerId,
//                 metadata
//             );

//             res.status(200).json({
//                 success: true,
//                 data: { message: updatedMessage },
//                 message: 'Message updated successfully'
//             });
//         } catch (error) {
//             next(error); // centralized error handler
//         }
//     }

//     async deleteMessage(req, res, next) {
//         const { messageId } = req.params;
//         const { customerId } = req.query;

//         if (!customerId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Customer ID is required'
//             });
//         }

//         try {
//             await messageService.deleteMessage(messageId, customerId);

//             res.status(200).json({
//                 success: true,
//                 message: 'Message deleted successfully'
//             });
//         } catch (error) {
//             next(error);
//         }
//     }

//     async getMessageHistory(req, res, next) {
//         const { sessionId } = req.params;
//         const { customerId, limit, offset } = req.query;

//         if (!customerId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Customer ID is required'
//             });
//         }

//         try {
//             const messages = await messageService.getChatHistory(
//                 sessionId,
//                 limit ? parseInt(limit) : 50,
//                 offset ? parseInt(offset) : 0
//             );

//             res.status(200).json({
//                 success: true,
//                 data: { messages }
//             });
//         } catch (error) {
//             next(error);
//         }
//     }
// }

// module.exports = new MessageController();
