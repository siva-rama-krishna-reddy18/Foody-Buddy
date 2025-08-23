const chatController = require('../../src/controllers/chatController');
const chatService = require('../../src/services/chatservice');

jest.mock('../../src/services/chatservice', () => ({
  createSession: jest.fn().mockResolvedValue({ id: 's1' }),
  getUserSessions: jest.fn().mockResolvedValue([]),
  saveMessage: jest.fn().mockResolvedValue({ message: 'ok' }),
  getChatHistory: jest.fn().mockResolvedValue([]),
  getSessionById: jest.fn(),
  getAIResponse: jest.fn(),
  deleteSession: jest.fn(),
  updateSessionTitle: jest.fn(),
  getSessionWithMessages: jest.fn(),
}));

describe('ChatController', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  // ---------------- createSession ----------------
  describe('createSession', () => {
    it('should return 400 if customerId is missing', async () => {
      req.body = { title: 'My Chat' };

      await chatController.createSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer ID is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should create a session successfully', async () => {
      req.body = { customerId: 'c1', title: 'Chat' };
      const mockSession = { id: 's1', title: 'Chat' };
      chatService.createSession.mockResolvedValue(mockSession);

      await chatController.createSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { session: mockSession },
        message: 'Chat session created successfully'
      });
    });

    it('should call next(error) on failure', async () => {
      req.body = { customerId: 'c1' };
      const error = new Error('DB error');
      chatService.createSession.mockRejectedValue(error);

      await chatController.createSession(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- getSessions ----------------
  describe('getSessions', () => {
    it('should return 400 if customerId missing', async () => {
      await chatController.getSessions(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer ID is required'
      });
    });

    it('should return sessions successfully', async () => {
      req.query = { customerId: 'c1', limit: '5' };
      const mockSessions = [{ id: 's1' }];
      chatService.getUserSessions.mockResolvedValue(mockSessions);

      await chatController.getSessions(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { sessions: mockSessions }
      });
    });

    it('should call next(error) on failure', async () => {
      req.query = { customerId: 'c1' };
      const error = new Error('Failed');
      chatService.getUserSessions.mockRejectedValue(error);

      await chatController.getSessions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- getMessages ----------------
  describe('getMessages', () => {
    it('should return 400 if customerId missing', async () => {
      req.params.sessionId = 's1';

      await chatController.getMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer ID is required'
      });
    });

    it('should return 404 if session not found or not owned', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      chatService.getSessionById.mockResolvedValue(null);

      await chatController.getMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found or access denied'
      });
    });

    it('should return messages successfully', async () => {
      req.params.sessionId = 's1';
      req.query = { customerId: 'c1', limit: '2', offset: '0' };
      const mockSession = { id: 's1', customer_id: 'c1' };
      const mockMessages = [{ id: 'm1' }];
      chatService.getSessionById.mockResolvedValue(mockSession);
      chatService.getChatHistory.mockResolvedValue(mockMessages);

      await chatController.getMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { messages: mockMessages, session: mockSession }
      });
    });

    it('should call next(error) on failure', async () => {
      req.params.sessionId = 's1';
      req.query = { customerId: 'c1' };
      const error = new Error('DB error');
      chatService.getSessionById.mockRejectedValue(error);

      await chatController.getMessages(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- sendMessage ----------------
  describe('sendMessage', () => {
    it('should return 400 if missing fields', async () => {
      req.body = { sessionId: 's1', content: 'Hello' };

      await chatController.sendMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session ID, customer ID, and content are required'
      });
    });

    it('should return 404 if session not found', async () => {
      req.body = { sessionId: 's1', customerId: 'c1', content: 'Hello' };
      chatService.getSessionById.mockResolvedValue(null);

      await chatController.sendMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found or access denied'
      });
    });

    it('should send message and AI response successfully', async () => {
      req.body = { sessionId: 's1', customerId: 'c1', content: 'Hi' };
      const session = { id: 's1', customer_id: 'c1' };
      const userMessage = { id: 'm1', content: 'Hi' };
      const aiMessage = { id: 'm2', content: 'Hello!' };

      chatService.getSessionById.mockResolvedValue(session);
      chatService.saveMessage.mockResolvedValueOnce(userMessage);
      chatService.getAIResponse.mockResolvedValue('Hello!');
      chatService.saveMessage.mockResolvedValueOnce(aiMessage);

      await chatController.sendMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { userMessage, aiMessage }
      });
    });

    it('should call next(error) on failure', async () => {
      req.body = { sessionId: 's1', customerId: 'c1', content: 'Hi' };
      const error = new Error('Save failed');
      chatService.getSessionById.mockRejectedValue(error);

      await chatController.sendMessage(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- deleteSession ----------------
  describe('deleteSession', () => {
    it('should return 400 if customerId missing', async () => {
      req.params.sessionId = 's1';

      await chatController.deleteSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer ID is required'
      });
    });

    it('should delete session successfully', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      chatService.deleteSession.mockResolvedValue(true);

      await chatController.deleteSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Session deleted successfully'
      });
    });

    it('should call next(error) on failure', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      const error = new Error('Delete failed');
      chatService.deleteSession.mockRejectedValue(error);

      await chatController.deleteSession(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- updateSessionTitle ----------------
  describe('updateSessionTitle', () => {
    it('should return 400 if missing fields', async () => {
      req.params.sessionId = 's1';
      req.body = { title: 'Chat' }; // no customerId

      await chatController.updateSessionTitle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Title and customer ID are required'
      });
    });

    it('should return 404 if session not found', async () => {
      req.params.sessionId = 's1';
      req.body = { title: 'New', customerId: 'c1' };
      chatService.getSessionById.mockResolvedValue(null);

      await chatController.updateSessionTitle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found or access denied'
      });
    });

    it('should update session title successfully', async () => {
      req.params.sessionId = 's1';
      req.body = { title: 'New', customerId: 'c1' };
      const session = { id: 's1', customer_id: 'c1' };
      const updatedSession = { ...session, title: 'New' };
      chatService.getSessionById.mockResolvedValue(session);
      chatService.updateSessionTitle.mockResolvedValue(updatedSession);

      await chatController.updateSessionTitle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { session: updatedSession },
        message: 'Session title updated successfully'
      });
    });

    it('should call next(error) on failure', async () => {
      req.params.sessionId = 's1';
      req.body = { title: 'New', customerId: 'c1' };
      const error = new Error('Update failed');
      chatService.getSessionById.mockRejectedValue(error);

      await chatController.updateSessionTitle(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ---------------- getSessionWithMessages ----------------
  describe('getSessionWithMessages', () => {
    it('should return 400 if customerId missing', async () => {
      req.params.sessionId = 's1';

      await chatController.getSessionWithMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer ID is required'
      });
    });

    it('should return session with messages successfully', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      const mockData = { id: 's1', messages: [] };
      chatService.getSessionWithMessages.mockResolvedValue(mockData);

      await chatController.getSessionWithMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      });
    });

    it('should call next(error) on failure', async () => {
      req.params.sessionId = 's1';
      req.query.customerId = 'c1';
      const error = new Error('Fetch failed');
      chatService.getSessionWithMessages.mockRejectedValue(error);

      await chatController.getSessionWithMessages(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
