const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({ clientId: 'notificaciones-rutasur', brokers: ['localhost:9092'] });
// Grupo de consumidores independiente exigido por la arquitectura
const consumer = kafka.consumer({ groupId: 'notificaciones' }); 
const producer = kafka.producer();

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
const dbClient = new MongoClient(mongoUrl);

async function iniciarNotificaciones() {
  await dbClient.connect();
  const db = dbClient.db('rutasur');
  const colEventosProcesados = db.collection('eventos_procesados');

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });
  console.log('✅ Servicio de Notificaciones escuchando...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const evento = JSON.parse(message.value.toString());

      // 1. Filtrar: Solo reaccionamos ante entregas fallidas
      if (evento.tipo !== 'ENTREGA_FALLIDA') {
        return;
      }

      // 2. Idempotencia: Verificar si este consumidor ya procesó este evento
      const procesado = await colEventosProcesados.findOne({ 
        consumidor: 'notificaciones', 
        eventId: evento.eventId 
      });
      if (procesado) return;

      // 3. Reacción: Crear el aviso para el destinatario
      const aviso = {
        eventId: uuidv4(),
        shipmentId: evento.shipmentId,
        ocurridoEn: new Date().toISOString(),
        tipoNotificacion: 'FALLO_ENTREGA',
        motivo: evento.motivo,
        mensaje: `No pudimos entregar tu paquete. Motivo: ${evento.motivo}.`
      };

      // 4. Emitir el nuevo evento al topic correspondiente
      await producer.send({
        topic: 'notificaciones.enviadas',
        messages: [{ 
          key: evento.shipmentId, 
          value: JSON.stringify(aviso) 
        }]
      });

      // 5. Marcar como procesado para este grupo
      await colEventosProcesados.insertOne({
        consumidor: 'notificaciones',
        eventId: evento.eventId,
        procesadoEn: new Date()
      });

      console.log(`✉️  Aviso publicado en notificaciones.enviadas para ${evento.shipmentId}`);
    },
  });
}

iniciarNotificaciones().catch(console.error);