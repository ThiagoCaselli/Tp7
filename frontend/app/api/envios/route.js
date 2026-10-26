// frontend/app/api/envios/route.js
import { MongoClient } from 'mongodb';

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
let client;

export async function GET(req) {
  if (!client) {
    client = new MongoClient(mongoUrl);
    await client.connect();
  }
  
  const db = client.db('rutasur');
  // Escuchamos la colección de envíos
  const changeStream = db.collection('envios').watch([], { fullDocument: 'updateLookup' });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Enviamos un evento inicial para establecer la conexión
      controller.enqueue(encoder.encode(`data: {"mensaje": "Conectado al stream de envíos"}\n\n`));

      changeStream.on('change', (change) => {
        // Empujamos cada cambio en tiempo real al frontend
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(change)}\n\n`));
      });

      // Si el cliente cierra el navegador, cerramos el stream
      req.signal.addEventListener('abort', () => {
        changeStream.close();
      });
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