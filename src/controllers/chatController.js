// const chatService = require('../services/chatservice'); // sessions
// const messageService = require('../services/messageService'); // messages
// const orchestratorService = require('../services/orchestratorService'); // RAG + HF
// //const messageService = require('../services/messageService');
// const { onUserMessage } = require('../services/onMessages');
// class ChatController {
//     async createSession(req, res, next) {
//         try {
//             const { customerId, title } = req.body;

//             if (!customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Customer ID is required'
//                 });
//             }

//             const session = await chatService.createSession(customerId, title);

//             res.status(201).json({
//                 success: true,
//                 data: { session },
//                 message: 'Chat session created successfully'
//             });
//         } catch (error) {
//             next(error);
//         }
//     }

//     async getSessions(req, res, next) {
//         try {
//             const { customerId, limit } = req.query;

//             if (!customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Customer ID is required'
//                 });
//             }

//             const sessions = await chatService.getUserSessions(
//                 customerId,
//                 limit ? parseInt(limit, 10) : 20
//             );

//             res.status(200).json({
//                 success: true,
//                 data: { sessions }
//             });
//         } catch (error) {
//             next(error);
//         }
//     }

//     async getMessages(req, res, next) {
//         try {
//             const { sessionId } = req.params;
//             const { customerId, limit, offset } = req.query;

//             if (!customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Customer ID is required'
//                 });
//             }

//             const session = await chatService.getSessionById(sessionId);
//             if (!session || session.customer_id !== customerId) {
//                 return res.status(404).json({
//                     success: false,
//                     error: 'Session not found or access denied'
//                 });
//             }

//             const messages = await messageService.getChatHistory(
//                 sessionId,
//                 limit ? parseInt(limit, 10) : 50,
//                 offset ? parseInt(offset, 10) : 0
//             );

//             res.status(200).json({
//                 success: true,
//                 data: { messages, session }
//             });
//         } catch (error) {
//             next(error);
//         }
//     }

    
    
// // controllers/chatController.js


// async sendMessage(req, res, next) {
//   try {
//     const { sessionId, customerId, content, messageType = 'text' } = req.body;

//     // 1) store user message
//     const userMessage = await messageService.saveMessage(sessionId, content, 'customer', messageType);

//     // 2) orchestrate
//     await onUserMessage({ sessionId, customerId, content });

//     // 3) fetch last AI message to return
//     const messages = await messageService.getChatHistory(sessionId, 1, 0);
//     const aiMessage = messages[0];

//     res.status(200).json({ success: true, data: { userMessage, aiMessage } });
//   } catch (err) { next(err); }
// }


//     // async sendMessage(req, res, next) {
//     //     try {
//     //         const { sessionId, customerId, content, messageType } = req.body;

//     //         if (!sessionId || !customerId || !content) {
//     //             return res.status(400).json({
//     //                 success: false,
//     //                 error: 'Session ID, customer ID, and content are required'
//     //             });
//     //         }

//     //         const session = await chatService.getSessionById(sessionId);
//     //         if (!session || session.customer_id !== customerId) {
//     //             return res.status(404).json({
//     //                 success: false,
//     //                 error: 'Session not found or access denied'
//     //             });
//     //         }

//     //         // 1) Save user message (embeddings handled inside messageService)
//     //         const userMessage = await messageService.saveMessage(
//     //             sessionId,
//     //             content,
//     //             'customer',
//     //             messageType
//     //         );

//     //         // 2) Orchestrate AI (retrieves context + generates HF response)
//     //         const { aiText } = await orchestratorService.respondToMessage({
//     //             sessionId,
//     //             customerId,
//     //             content
//     //         });

//     //         // 3) Save AI message (embeddings handled inside messageService)
//     //         const aiMessage = await messageService.saveMessage(
//     //             sessionId,
//     //             aiText,
//     //             'ai',
//     //             'text'
//     //         );

//     //         res.status(200).json({
//     //             success: true,
//     //             data: { userMessage, aiMessage }
//     //         });
//     //     } catch (error) {
//     //         next(error);
//     //     }
//     // }

//     // async deleteSession(req, res, next) {
//     //     try {
//     //         const { sessionId } = req.params;
//     //         const { customerId } = req.query;

//     //         if (!customerId) {
//     //             return res.status(400).json({
//     //                 success: false,
//     //                 error: 'Customer ID is required'
//     //             });
//     //         }

//     //         await chatService.deleteSession(sessionId, customerId);

//     //         res.status(200).json({
//     //             success: true,
//     //             message: 'Session deleted successfully'
//     //         });
//     //     } catch (error) {
//     //         next(error);
//     //     }
//     // }

//     // NEW WEEK 2 METHODS
//     async updateSessionTitle(req, res, next) {
//         try {
//             const { sessionId } = req.params;
//             const { title, customerId } = req.body;

//             if (!title || !customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Title and customer ID are required'
//                 });
//             }

//             const session = await chatService.getSessionById(sessionId);
//             if (!session || session.customer_id !== customerId) {
//                 return res.status(404).json({
//                     success: false,
//                     error: 'Session not found or access denied'
//                 });
//             }

//             const updatedSession = await chatService.updateSessionTitle(sessionId, title);

//             res.status(200).json({
//                 success: true,
//                 data: { session: updatedSession },
//                 message: 'Session title updated successfully'
//             });
//         } catch (error) {
//             next(error);
//         }
//     }

//     async getSessionWithMessages(req, res, next) {
//         try {
//             const { sessionId } = req.params;
//             const { customerId } = req.query;

//             if (!customerId) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'Customer ID is required'
//                 });
//             }

//             const sessionData = await chatService.getSessionWithMessages(sessionId, customerId);

//             res.status(200).json({
//                 success: true,
//                 data: sessionData
//             });
//         } catch (error) {
//             next(error);
//         }
//     }
// }

// module.exports = new ChatController();
