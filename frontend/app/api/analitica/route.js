import { MongoClient } from 'mongodb';

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
let client;

export async function GET(req) {
  if (!client) {
    client = new MongoClient(mongoUrl);
    await client.connect();
  }
  
  const db = client.db('rutasur');
  // Obtenemos los parámetros de filtro de la URL
  const { searchParams } = new URL(req.url);
  const zonaId = searchParams.get('zonaId');
  const fecha = searchParams.get('fecha');

  // Armamos la consulta dinámica
  const query = {};
  if (zonaId) query.zonaId = zonaId;
  if (fecha) query.fecha = fecha;

  const metricas = await db.collection('metricas_diarias').find(query).toArray();

  return new Response(JSON.stringify(metricas), {
    headers: { 'Content-Type': 'application/json' },
  });
}