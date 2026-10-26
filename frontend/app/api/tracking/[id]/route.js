import { MongoClient } from 'mongodb';

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
let client;

export async function GET(req, { params }) {
  if (!client) {
    client = new MongoClient(mongoUrl);
    await client.connect();
  }
  
  const db = client.db('rutasur');
  // Usamos await params.id por compatibilidad con las nuevas versiones de Next.js
  const id = (await params).id; 
  
  const envio = await db.collection('envios').findOne({ shipmentId: id });

  if (!envio) {
    return new Response(JSON.stringify({ error: 'Envío no encontrado' }), { status: 404 });
  }

  // Devolvemos todo el documento (el frontend filtrará qué mostrar)
  return new Response(JSON.stringify(envio), {
    headers: { 'Content-Type': 'application/json' },
  });
}