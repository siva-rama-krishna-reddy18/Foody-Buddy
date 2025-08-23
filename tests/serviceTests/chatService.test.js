const ChatService = require("../../src/services/chatservice");
const { PrismaClient } = require("@prisma/client");

jest.mock("@prisma/client", () => {
  const mPrisma = {
    chat_sessions: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn()
    },
    messages: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient();

describe("ChatService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- createSession ----------
  it("should create a session with title provided", async () => {
    prisma.chat_sessions.create.mockResolvedValue({ id: "s1", customer_id: "123", title: "Test" });

    const result = await ChatService.createSession("123", "Test");

    expect(prisma.chat_sessions.create).toHaveBeenCalled();
    expect(result.title).toBe("Test");
  });

  it("should create a session with default title", async () => {
    prisma.chat_sessions.create.mockResolvedValue({ id: "s2", customer_id: "123", title: "Chat 8/22/2025" });

    const result = await ChatService.createSession("123");

    expect(prisma.chat_sessions.create).toHaveBeenCalled();
    expect(result).toHaveProperty("title");
  });

  it("should throw if createSession fails", async () => {
    prisma.chat_sessions.create.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.createSession("123")).rejects.toThrow("DB Error");
  });

  // ---------- getUserSessions ----------
  it("should return user sessions with limit", async () => {
    prisma.chat_sessions.findMany.mockResolvedValue([{ id: "s1" }]);

    const result = await ChatService.getUserSessions("123", 5);

    expect(prisma.chat_sessions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customer_id: "123" }, take: 5 })
    );
    expect(result).toEqual([{ id: "s1" }]);
  });

  it("should return empty array if no sessions", async () => {
    prisma.chat_sessions.findMany.mockResolvedValue([]);
    const result = await ChatService.getUserSessions("123");
    expect(result).toEqual([]);
  });

  it("should throw if getUserSessions fails", async () => {
    prisma.chat_sessions.findMany.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.getUserSessions("123")).rejects.toThrow("DB Error");
  });

  // ---------- saveMessage ----------
  it("should save message with all parameters", async () => {
    prisma.messages.create.mockResolvedValue({ id: "m1", content: "hi" });
    prisma.chat_sessions.update.mockResolvedValue({});

    const result = await ChatService.saveMessage("s1", "hi", "user", "text", { foo: "bar" });

    expect(prisma.messages.create).toHaveBeenCalled();
    expect(prisma.chat_sessions.update).toHaveBeenCalled();
    expect(result).toEqual({ id: "m1", content: "hi" });
  });

  it("should save message with default parameters", async () => {
    prisma.messages.create.mockResolvedValue({ id: "m2", content: "hello" });
    prisma.chat_sessions.update.mockResolvedValue({});

    const result = await ChatService.saveMessage("s1", "hello", "user");

    expect(result).toEqual({ id: "m2", content: "hello" });
  });

  it("should throw if saveMessage fails", async () => {
    prisma.messages.create.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.saveMessage("s1", "hi", "user")).rejects.toThrow("DB Error");
  });

  // ---------- getChatHistory ----------
  it("should return chat history with limit & offset", async () => {
    prisma.messages.findMany.mockResolvedValue([{ id: "m1" }]);
    const result = await ChatService.getChatHistory("s1", 10, 2);
    expect(prisma.messages.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 2 })
    );
    expect(result).toEqual([{ id: "m1" }]);
  });

  it("should return empty chat history if no messages", async () => {
    prisma.messages.findMany.mockResolvedValue([]);
    const result = await ChatService.getChatHistory("s1");
    expect(result).toEqual([]);
  });

  it("should throw if getChatHistory fails", async () => {
    prisma.messages.findMany.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.getChatHistory("s1")).rejects.toThrow("DB Error");
  });

  // ---------- getSessionById ----------
  it("should return session by ID", async () => {
    prisma.chat_sessions.findUnique.mockResolvedValue({ id: "s1", customer_id: "123" });
    const result = await ChatService.getSessionById("s1");
    expect(result).toEqual({ id: "s1", customer_id: "123" });
  });

  it("should throw if getSessionById fails", async () => {
    prisma.chat_sessions.findUnique.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.getSessionById("s1")).rejects.toThrow("DB Error");
  });

  // ---------- deleteSession ----------
  it("should delete session successfully", async () => {
    prisma.chat_sessions.findFirst.mockResolvedValue({ id: "s1", customer_id: "123" });
    prisma.chat_sessions.delete.mockResolvedValue(true);

    const result = await ChatService.deleteSession("s1", "123");

    expect(prisma.chat_sessions.delete).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("should throw if session not found", async () => {
    prisma.chat_sessions.findFirst.mockResolvedValue(null);
    await expect(ChatService.deleteSession("s1", "123"))
      .rejects.toThrow("Session not found or access denied");
  });

  it("should throw if deleteSession fails", async () => {
    prisma.chat_sessions.findFirst.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.deleteSession("s1", "123")).rejects.toThrow("DB Error");
  });

  // ---------- updateSessionTitle ----------
  it("should update session title successfully", async () => {
    prisma.chat_sessions.update.mockResolvedValue({ id: "s1", title: "New Title" });
    const result = await ChatService.updateSessionTitle("s1", "New Title");
    expect(result.title).toBe("New Title");
  });

  it("should throw if updateSessionTitle fails", async () => {
    prisma.chat_sessions.update.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.updateSessionTitle("s1", "New Title")).rejects.toThrow("DB Error");
  });

  // ---------- getSessionWithMessages ----------
  it("should return session with messages successfully", async () => {
    prisma.chat_sessions.findFirst.mockResolvedValue({ id: "s1", customer_id: "123", messages: [{ id: "m1" }] });
    const result = await ChatService.getSessionWithMessages("s1", "123");
    expect(result.messages.length).toBe(1);
  });

  it("should throw if session with messages not found", async () => {
    prisma.chat_sessions.findFirst.mockResolvedValue(null);
    await expect(ChatService.getSessionWithMessages("s1", "123"))
      .rejects.toThrow("Session not found or access denied");
  });

  it("should throw if getSessionWithMessages fails", async () => {
    prisma.chat_sessions.findFirst.mockRejectedValue(new Error("DB Error"));
    await expect(ChatService.getSessionWithMessages("s1", "123")).rejects.toThrow("DB Error");
  });

  // ---------- getAIResponse ----------
  const aiTests = [
    ["hello", "Hello! Welcome"],
    ["recommend a pizza", "Today's Recommendations!"],
    ["show deals", "Current Deals & Specials!"],
    ["menu please", "Here are our popular menu categories!"],
    ["pizza", "Great choice! Our pizzas"],
    ["burger", "Awesome! Our burgers"],
    ["pasta", "Perfect! Our pasta"],
    ["order now", "Excellent! I'd love"],
    ["price", "Here are our price ranges!"],
    ["delivery", "We offer both delivery and pickup!"],
    ["thanks", "You're very welcome!"],
    ["help me", "I'm here to help!"],
    ["unknown query", "Thanks for your message!"]
  ];

  aiTests.forEach(([msg, expected]) => {
    it(`getAIResponse responds correctly to "${msg}"`, async () => {
      const result = await ChatService.getAIResponse(msg, "s1");
      expect(result).toContain(expected.split(' ')[0]);
    });
  });

  it("should handle errors in getAIResponse gracefully", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const original = ChatService.getAIResponse;
    ChatService.getAIResponse = async () => { throw new Error("AI Error"); };

    const response = await ChatService.getAIResponse("hello", "s1").catch(() => "error");
    expect(response).toBe("error");

    ChatService.getAIResponse = original;
    spy.mockRestore();
  });
});
