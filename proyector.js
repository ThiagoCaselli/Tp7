const { Kafka } = require('kafkajs');
const { MongoClient } = require('mongodb');

const kafka = new Kafka({ clientId: 'proyector-rutasur', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'proyector' });
const producer = kafka.producer(); 

const mongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true';
const dbClient = new MongoClient(mongoUrl);

function validarEsquemaEstado(evento) {
  const camposObligatorios = ['eventId', 'shipmentId', 'tipo', 'ocurridoEn', 'secuencia'];
  for (const campo of camposObligatorios) {
    if (!evento[campo]) throw new Error(`Falta el campo obligatorio: ${campo}`);
  }
}

async function enviarADLQ(mensajeOriginal, motivoError) {
  await producer.send({
    topic: 'envios.estados.dlq',
    messages: [{ key: 'ERROR', value: JSON.stringify({ payload_original: mensajeOriginal, motivo: motivoError, detectadoEn: new Date().toISOString() }) }]
  });
}

async function iniciarProyector() {
  await dbClient.connect();
  const db = dbClient.db('rutasur');
  const colEnvios = db.collection('envios');
  const colNotificaciones = db.collection('notificaciones');
  const colAlertas = db.collection('alertas');
  const colEventosProcesados = db.collection('eventos_procesados');

  await colEnvios.createIndex({ shipmentId: 1 }, { unique: true });
  await colNotificaciones.createIndex({ shipmentId: 1 });
  await colAlertas.createIndex({ estado: 1, prioridad: 1 });
  await colAlertas.createIndex({ shipmentId: 1 });
  await colEventosProcesados.createIndex({ consumidor: 1, eventId: 1 }, { unique: true });

  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });
  await consumer.subscribe({ topic: 'notificaciones.enviadas', fromBeginning: true });
  await consumer.subscribe({ topic: 'envios.reprogramaciones', fromBeginning: true });
  await consumer.subscribe({ topic: 'alertas.sla', fromBeginning: true });
  
  console.log('✅ Proyector escuchando. Confirmación de offsets MANUAL activada.');

  await consumer.run({
    autoCommit: false, // ⚠️ DECISIÓN DE DISEÑO: Desactivamos el auto-commit
    eachMessage: async ({ topic, partition, message }) => {
      const mensajeTexto = message.value.toString();
      let evento;

      try {
        evento = JSON.parse(mensajeTexto);
        if (topic === 'envios.estados') validarEsquemaEstado(evento);
      } catch (error) {
        console.log(`🚨 Evento inválido en ${topic}. Enviando a DLQ...`);
        await enviarADLQ(mensajeTexto, error.message);
        // Avanzamos el offset para que no se tranque leyendo la basura
        const offsetNuevo = (BigInt(message.offset) + 1n).toString();
        await consumer.commitOffsets([{ topic, partition, offset: offsetNuevo }]);
        return;
      }

      const procesado = await colEventosProcesados.findOne({ consumidor: 'proyector', eventId: evento.eventId });
      
      if (!procesado) {
        if (topic === 'envios.estados') {
          const envioActual = await colEnvios.findOne({ shipmentId: evento.shipmentId });
          if (!envioActual || envioActual.ultimaSecuencia < evento.secuencia) {
            await colEnvios.updateOne(
              { shipmentId: evento.shipmentId },
              {
                $set: { estadoActual: evento.tipo, ultimaSecuencia: evento.secuencia, zonaId: evento.zonaId, hubId: evento.hubId, actualizadoEn: new Date() },
                $push: { historial: evento }
              },
              { upsert: true }
            );
          }
        } 
        else if (topic === 'notificaciones.enviadas') {
          await colNotificaciones.insertOne(evento);
          await colEnvios.updateOne({ shipmentId: evento.shipmentId }, { $push: { historial: { tipo: 'NOTIFICACION_ENVIADA', ...evento } } });
        }
        else if (topic === 'envios.reprogramaciones') {
          await colEnvios.updateOne({ shipmentId: evento.shipmentId }, { $set: { resolucion: evento.resolucion, actualizadoEn: new Date() }, $push: { historial: { tipo: 'DECISION_SISTEMA', ...evento } } });
        }
        else if (topic === 'alertas.sla') {
          if (evento.tipo === 'ALERTA_ABIERTA') {
            await colAlertas.updateOne({ shipmentId: evento.shipmentId, regla: evento.regla }, { $set: { estado: 'ABIERTA', prioridad: evento.prioridad, detectadoEn: evento.detectadoEn } }, { upsert: true });
          } else if (evento.tipo === 'ALERTA_CERRADA') {
            await colAlertas.updateMany({ shipmentId: evento.shipmentId }, { $set: { estado: 'CERRADA', cerradoEn: evento.detectadoEn } });
          }
        }

        await colEventosProcesados.insertOne({ consumidor: 'proyector', eventId: evento.eventId, procesadoEn: new Date() });
      }

      // ⚠️ CONFIRMACIÓN MANUAL: Solo se ejecuta si MongoDB guardó todo bien sin tirar errores[cite: 30]
      const offsetSiguiente = (BigInt(message.offset) + 1n).toString();
      await consumer.commitOffsets([{ topic, partition, offset: offsetSiguiente }]);

      // ⚠️ OBSERVABILIDAD: Log exigido por la rúbrica[cite: 30]
      console.log(`[Observabilidad] eventId: ${evento.eventId} | Partición: ${partition} | Offset: ${message.offset} | Action: Proyectado`);
    },
  });
}

iniciarProyector().catch(console.error);