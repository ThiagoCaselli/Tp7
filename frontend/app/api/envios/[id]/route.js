import { MongoClient } from 'mongodb';

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
let client;

export async function GET(req, { params }) {
  if (!client) {
    client = new MongoClient(mongoUrl);
    await client.connect();
  }
  
  const db = client.db('rutasur');
  const id = (await params).id; 
  
  const envio = await db.collection('envios').findOne({ shipmentId: id });

  if (!envio) {
    return new Response(JSON.stringify({ error: 'Envío no encontrado' }), { status: 404 });
  }

  // Buscamos también las alertas asociadas a este envío específico
  const alertas = await db.collection('alertas').find({ shipmentId: id }).toArray();

  return new Response(JSON.stringify({ ...envio, alertasAsociadas: alertas }), {
    headers: { 'Content-Type': 'application/json' },
  });
}