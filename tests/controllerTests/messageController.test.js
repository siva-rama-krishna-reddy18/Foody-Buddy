// tests/messageController.test.js
const chatService = require('../../src/services/chatservice'); // adjust path if needed
const messageController = require('../../src/controllers/messageController'); // instance

// Mock all methods of chatService used by the controller
jest.mock('../../src/services/chatservice', () => ({
  updateMessage: jest.fn(),
  deleteMessage: jest.fn(),
  getChatHistory: jest.fn(),
}));

describe('MessageController', () => {
  let req, res, next;

  beforeEach(() => {
    req = { params: {}, body: {}, query: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('updateMessage', () => {
    it('should update message successfully', async () => {
      req.params.messageId = 'm1';
      req.body = { content: 'Hello', customerId: 'c1', metadata: { key: 'value' } };
      chatService.updateMessage.mockResolvedValue({ id: 'm1', content: 'Hello' });

      await messageController.updateMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Message updated successfully',
        data: { message: { id: 'm1', content: 'Hello' } }
      }));
    });

    it('should call next on error', async () => {
      req.params.messageId = 'm1';
      req.body = { content: 'Hello', customerId: 'c1' };
      const error = new Error('DB Error');
      chatService.updateMessage.mockRejectedValue(error);

      await messageController.updateMessage(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should return 400 if content or customerId missing', async () => {
      req.body = { content: '' };
      await messageController.updateMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Content and customer ID are required'
      }));
    });
  });

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      req.params.messageId = 'm1';
      req.query.customerId = 'c1';
      chatService.deleteMessage.mockResolvedValue();

      await messageController.deleteMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Message deleted successfully'
      }));
    });

    it('should call next on error', async () => {
      req.params.messageId = 'm1';
      req.query.customerId = 'c1';
      const error = new Error('DB Error');
      chatService.deleteMessage.mockRejectedValue(error);

      await messageController.deleteMessage(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should return 400 if customerId missing', async () => {
      await messageController.deleteMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Customer ID is required'
      }));
    });
  });

  describe('getMessageHistory', () => {
    it('should return messages successfully', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      req.query.limit = '10';
      req.query.offset = '5';
      const messages = [{ id: 'm1', content: 'Hello' }];
      chatService.getChatHistory.mockResolvedValue(messages);

      await messageController.getMessageHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { messages }
      }));
    });

    it('should call next on error', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      const error = new Error('DB Error');
      chatService.getChatHistory.mockRejectedValue(error);

      await messageController.getMessageHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should return 400 if customerId missing', async () => {
      req.params.sessionId = 's1';
      await messageController.getMessageHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Customer ID is required'
      }));
    });
  });
});
