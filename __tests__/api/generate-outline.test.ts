import handler from '../../pages/api/generate-outline';
import { createMocks } from 'node-mocks-http';

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '[]' } }]
          })
        }
      }
    }))
  };
});

describe('/api/generate-outline', () => {
  it('should return 400 if prompt is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { numSections: 3 }
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  // 你可以根據實際 API 實作補更多測試
}); 