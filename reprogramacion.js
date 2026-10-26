const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({ clientId: 'reprogramacion-rutasur', brokers: ['localhost:9092'] });
// Grupo independiente para la coreografía
const consumer = kafka.consumer({ groupId: 'reprogramacion' }); 
const producer = kafka.producer();

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
const dbClient = new MongoClient(mongoUrl);

async function iniciarReprogramacion() {
  await dbClient.connect();
  const db = dbClient.db('rutasur');
  const colEnvios = db.collection('envios');
  const colEventosProcesados = db.collection('eventos_procesados');

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });
  console.log('✅ Servicio de Reprogramación escuchando...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const evento = JSON.parse(message.value.toString());

      if (evento.tipo !== 'ENTREGA_FALLIDA') return;

      // Idempotencia
      const procesado = await colEventosProcesados.findOne({ 
        consumidor: 'reprogramacion', 
        eventId: evento.eventId 
      });
      if (procesado) return;

      // Contar intentos previos consultando la vista de lectura (MongoDB)
      const envio = await colEnvios.findOne({ shipmentId: evento.shipmentId });
      // Contamos fallos previos en el historial y sumamos 1 por el evento actual
      const fallosPrevios = envio && envio.historial 
        ? envio.historial.filter(e => e.tipo === 'ENTREGA_FALLIDA').length 
        : 0;
      const totalIntentos = fallosPrevios + 1;

      // Aplicar reglas de reprogramación
      let resolucion = '';
      
      if (totalIntentos >= 3) {
        resolucion = 'DEVOLUCION_COMERCIO';
      } else if (evento.motivo === 'RECHAZADO') {
        resolucion = 'DEVOLUCION_COMERCIO';
      } else if (evento.motivo === 'DIRECCION_INCORRECTA') {
        resolucion = 'RETENIDO';
      } else if (evento.motivo === 'AUSENTE') {
        resolucion = 'REPROGRAMADO';
      }

      const eventoReprogramacion = {
        eventId: uuidv4(),
        shipmentId: evento.shipmentId,
        ocurridoEn: new Date().toISOString(),
        resolucion: resolucion,
        motivoOriginal: evento.motivo,
        intentosHastaAhora: totalIntentos
      };

      // Emitir la decisión
      await producer.send({
        topic: 'envios.reprogramaciones',
        messages: [{ key: evento.shipmentId, value: JSON.stringify(eventoReprogramacion) }]
      });

      await colEventosProcesados.insertOne({
        consumidor: 'reprogramacion',
        eventId: evento.eventId,
        procesadoEn: new Date()
      });

      console.log(`🔄 Decisión para ${evento.shipmentId} (Intento ${totalIntentos}): ${resolucion}`);
    },
  });
}

iniciarReprogramacion().catch(console.error);