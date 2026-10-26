import { MongoClient } from 'mongodb';

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
let client;

export async function GET(req) {
  if (!client) {
    client = new MongoClient(mongoUrl);
    await client.connect();
  }
  
  const db = client.db('rutasur');
  const changeStream = db.collection('alertas').watch([], { fullDocument: 'updateLookup' });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: {"mensaje": "Conectado a alertas"}\n\n`));

      changeStream.on('change', (change) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(change)}\n\n`));
      });

      req.signal.addEventListener('abort', () => changeStream.close());
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}