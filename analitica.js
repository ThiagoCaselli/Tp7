const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');

const kafka = new Kafka({ clientId: 'analitica-rutasur', brokers: ['localhost:9092'] });
// Tercer grupo independiente reaccionando al mismo evento
const consumer = kafka.consumer({ groupId: 'analitica' }); 

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
const dbClient = new MongoClient(mongoUrl);

// Función auxiliar para determinar la franja horaria
function obtenerFranjaHoraria(fechaIso) {
  const hora = new Date(fechaIso).getHours();
  if (hora < 12) return 'MAÑANA';
  if (hora < 18) return 'TARDE';
  return 'NOCHE';
}

async function iniciarAnalitica() {
  await dbClient.connect();
  const db = dbClient.db('rutasur');
  const colMetricas = db.collection('metricas_diarias');
  const colEventosProcesados = db.collection('eventos_procesados');

  // Crear índice compuesto requerido por el modelo de datos
  await colMetricas.createIndex({ fecha: 1, zonaId: 1, franja: 1 }, { unique: true });

  await consumer.connect();
  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });
  console.log('✅ Servicio de Analítica escuchando y calculando métricas...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const evento = JSON.parse(message.value.toString());

      if (evento.tipo !== 'ENTREGA_FALLIDA') return;

      // Idempotencia
      const procesado = await colEventosProcesados.findOne({ 
        consumidor: 'analitica', 
        eventId: evento.eventId 
      });
      if (procesado) return;

      const fecha = evento.ocurridoEn.split('T')[0];
      const franja = obtenerFranjaHoraria(evento.ocurridoEn);

      // Incremento atómico en la vista de lectura
      // Estructuramos la clave dinámica según el motivo del fallo
      const campoMotivo = `motivos.${evento.motivo}`;

      await colMetricas.updateOne(
        { fecha: fecha, zonaId: evento.zonaId, franja: franja },
        { 
          $inc: { 
            totalFallos: 1,
            [campoMotivo]: 1
          } 
        },
        { upsert: true }
      );

      await colEventosProcesados.insertOne({
        consumidor: 'analitica',
        eventId: evento.eventId,
        procesadoEn: new Date()
      });

      console.log(`📊 Métrica actualizada -> Zona: ${evento.zonaId}, Franja: ${franja}, Motivo: ${evento.motivo}`);
    },
  });
}

iniciarAnalitica().catch(console.error);