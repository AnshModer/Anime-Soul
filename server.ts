import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);

  // WebSocket Server for Gemini Live API
  const wss = new WebSocketServer({ server, path: '/api/live-ws' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    console.log('Client connected to Live WebSocket');
    let session: any = null;
    let isClosing = false;

    clientWs.on('message', async (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'init') {
          const { systemInstruction, voiceName } = msg;
          const ai = getGeminiClient();

          const LIVE_MODELS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview'];
          let lastLiveError: any = null;

          const liveInstruction = systemInstruction
            ? `${systemInstruction}\n\nSTRICT RULE: Keep your spoken answers brief and punchy, approximately 2 to 3 sentences (equivalent to 3 to 4 lines). Do not monologue.`
            : 'You are an anime character. Keep spoken answers brief, 2 to 3 sentences.';

          for (const liveModel of LIVE_MODELS) {
            try {
              session = await ai.live.connect({
                model: liveModel,
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' },
                    },
                  },
                  systemInstruction: liveInstruction,
                },
                callbacks: {
                  onopen: () => {
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ type: 'connected' }));
                    }
                  },
                  onmessage: (serverMessage: LiveServerMessage) => {
                    if (clientWs.readyState !== WebSocket.OPEN) return;

                    const audioData =
                      serverMessage.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                      clientWs.send(JSON.stringify({ type: 'audio', audio: audioData }));
                    }

                    if (serverMessage.serverContent?.interrupted) {
                      clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
                    }
                  },
                  onclose: () => {
                    if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ type: 'closed' }));
                    }
                  },
                  onerror: (err: any) => {
                    console.error('Gemini Live Session Error:', err);
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'error',
                          error: err?.message || 'Live session error',
                        })
                      );
                    }
                  },
                },
              });
              console.log(`Live session connected with model: ${liveModel}`);
              break;
            } catch (liveErr: any) {
              console.warn(`Live model ${liveModel} failed:`, liveErr?.message);
              lastLiveError = liveErr;
            }
          }

          if (!session && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: lastLiveError?.message || 'Failed to connect to Live session',
              })
            );
          }
          return;
        }

        if (msg.type === 'audio' && msg.audio && session) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      } catch (err: any) {
        console.error('Error handling WebSocket message:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              error: err?.message || 'Failed to process audio packet',
            })
          );
        }
      }
    });

    clientWs.on('close', () => {
      isClosing = true;
      try {
        if (session) {
          session.close();
        }
      } catch (e) {
        // Ignored on teardown
      }
    });
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Chat Streaming Endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, systemInstruction } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const ai = getGeminiClient();

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Keep recent 8 messages to preserve token budget and prevent hitting API rate limits
      if (Array.isArray(history)) {
        const recentHistory = history.slice(-8);
        for (const item of recentHistory) {
          if (item.id === 'init') continue;
          if (item.text && item.text.trim()) {
            contents.push({
              role: item.role === 'model' ? 'model' : 'user',
              parts: [{ text: item.text }],
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Prioritize fast, high-quota Gemini Flash-Lite models
      const CHAT_MODELS = [
        'gemini-2.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-3.8-flash',
      ];
      let activeStreamIterator: AsyncIterator<any> | null = null;
      let initialChunkText = '';
      let lastError: any = null;

      const lengthRule =
        'LENGTH CONSTRAINT: Keep your response natural, lively, and strictly around 3 to 4 lines (about 3 to 4 short, complete sentences). Always conclude your thought cleanly. Do not write essays, long lists, or oversized paragraphs.';
      const finalSystemInstruction = systemInstruction
        ? `${systemInstruction}\n\n${lengthRule}`
        : lengthRule;

      for (const model of CHAT_MODELS) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: finalSystemInstruction,
              maxOutputTokens: 600, // Generous enough for Hindi/Hinglish tokenization without cutting off mid-sentence
              temperature: 0.85,
            },
          });

          // Test first chunk before sending headers to confirm model is available
          const iterator = responseStream[Symbol.asyncIterator]();
          const firstResult = await iterator.next();
          if (!firstResult.done && firstResult.value) {
            initialChunkText = firstResult.value.text || '';
          }
          activeStreamIterator = iterator;
          console.log(`Chat generation streaming from model: ${model}`);
          break;
        } catch (modelErr: any) {
          console.warn(`Model ${model} unavailable (${modelErr?.status || modelErr?.code || 'error'}), attempting next fallback:`, modelErr?.message || modelErr);
          lastError = modelErr;
        }
      }

      if (!activeStreamIterator) {
        throw lastError || new Error('All candidate models are temporarily unavailable.');
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (initialChunkText) {
        res.write(`data: ${JSON.stringify({ text: initialChunkText })}\n\n`);
      }

      while (true) {
        const nextResult = await activeStreamIterator.next();
        if (nextResult.done) break;
        const text = nextResult.value?.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('Chat API error:', err);
      if (!res.headersSent) {
        res.status(503).json({
          error:
            err?.message ||
            'The character is currently experiencing high demand. Please try sending your message again in a moment!',
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error:
              err?.message ||
              'The character is currently experiencing high demand. Please try sending your message again in a moment!',
          })}\n\n`
        );
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AnimeSoul server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
