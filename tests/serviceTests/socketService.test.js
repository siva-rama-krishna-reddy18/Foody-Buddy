const SocketService = require('../../src/services/socketService'); // adjust path
const chatService = require('../../src/services/chatservice');
const { v4: uuidv4 } = require('uuid');

jest.mock('../../src/services/chatservice', () => ({
  createSession: jest.fn(),
  getAIResponse: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

describe('SocketService', () => {
  let ioMock, socketMock;

  beforeEach(() => {
    // reset mocks
    jest.clearAllMocks();

    socketMock = {
      id: 'socket1',
      emit: jest.fn(),
      on: jest.fn(),
      join: jest.fn()
    };

    ioMock = {
      on: jest.fn((event, callback) => {
        if (event === 'connection') callback(socketMock);
      })
    };
  });

  it('should initialize and send welcome message on connection', () => {
    SocketService(ioMock);

    expect(ioMock.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(socketMock.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      id: 'mock-uuid',
      message: expect.stringContaining('Connected to FoodyBuddy!'),
      sender: 'ai',
      timestamp: expect.any(Date)
    }));
  });

  describe('authentication', () => {
    it('should emit error if phone number missing', async () => {
      SocketService(ioMock);

      const authenticateCallback = socketMock.on.mock.calls.find(c => c[0] === 'authenticate')[1];
      await authenticateCallback({}); // empty data

      expect(socketMock.emit).toHaveBeenCalledWith('error', { message: 'Phone number is required' });
    });

    it('should authenticate and join session', async () => {
      chatService.createSession.mockResolvedValue({ id: 'session123' });

      SocketService(ioMock);

      const authenticateCallback = socketMock.on.mock.calls.find(c => c[0] === 'authenticate')[1];
      await authenticateCallback({ phoneNumber: '+111222333' });

      expect(chatService.createSession).toHaveBeenCalledWith('+111222333', expect.stringContaining('Chat'));
      expect(socketMock.sessionId).toBe('session123');
      expect(socketMock.join).toHaveBeenCalledWith('session123');
      expect(socketMock.emit).toHaveBeenCalledWith('authenticated', expect.objectContaining({
        success: true,
        sessionId: 'session123'
      }));
    });

    it('should emit error if createSession fails', async () => {
      chatService.createSession.mockRejectedValue(new Error('DB Error'));

      SocketService(ioMock);

      const authenticateCallback = socketMock.on.mock.calls.find(c => c[0] === 'authenticate')[1];
      await authenticateCallback({ phoneNumber: '+111222333' });

      expect(socketMock.emit).toHaveBeenCalledWith('error', { message: 'Authentication failed' });
    });
  });

  describe('message event', () => {
    it('should ignore empty messages', async () => {
      SocketService(ioMock);

      const messageCallback = socketMock.on.mock.calls.find(c => c[0] === 'message')[1];
      await messageCallback({ message: '   ' });

      expect(chatService.getAIResponse).not.toHaveBeenCalled();
      expect(socketMock.emit).toHaveBeenCalledTimes(1); // only initial welcome message
    });

    it('should call getAIResponse and emit AI message', async () => {
      chatService.getAIResponse.mockResolvedValue('Hello from AI');
      socketMock.sessionId = 'session123';

      SocketService(ioMock);

      const messageCallback = socketMock.on.mock.calls.find(c => c[0] === 'message')[1];
      await messageCallback({ message: 'Hi' });

      expect(chatService.getAIResponse).toHaveBeenCalledWith('Hi', 'session123');
      expect(socketMock.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        id: 'mock-uuid',
        message: 'Hello from AI',
        sender: 'ai',
        timestamp: expect.any(Date),
        sessionId: 'session123'
      }));
    });

    it('should create emergency session if none exists', async () => {
      chatService.createSession.mockResolvedValue({ id: 'emergency123' });
      chatService.getAIResponse.mockResolvedValue('Emergency AI response');
      socketMock.customerId = '+111222333';

      SocketService(ioMock);

      const messageCallback = socketMock.on.mock.calls.find(c => c[0] === 'message')[1];
      await messageCallback({ message: 'Hi there' });

      expect(chatService.createSession).toHaveBeenCalledWith('+111222333', 'Emergency Chat');
      expect(socketMock.sessionId).toBe('emergency123');
      expect(socketMock.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        message: 'Emergency AI response'
      }));
    });

    it('should emit error message if getAIResponse fails', async () => {
      chatService.getAIResponse.mockRejectedValue(new Error('DB Error'));
      socketMock.sessionId = 'session123';

      SocketService(ioMock);

      const messageCallback = socketMock.on.mock.calls.find(c => c[0] === 'message')[1];
      await messageCallback({ message: 'Hi' });

      expect(socketMock.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        message: "Error occurred! Check console.",
        sender: 'ai'
      }));
    });
  });
});
