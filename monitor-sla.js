const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({ clientId: 'monitor-sla-rutasur', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'monitor-sla' });
const producer = kafka.producer();

// Estado interno en memoria. Al reiniciar el servicio, se reconstruye 
// desde cero consumiendo ambos topics desde el principio.
const estadoEnvios = new Map();
let tiempoSimuladoActual = new Date(0);

async function evaluarRiesgoSLA(shipmentId) {
  const envio = estadoEnvios.get(shipmentId);
  if (!envio || !envio.venceEn || envio.estadoActual === 'ENTREGADO') return;

  const vencimiento = new Date(envio.venceEn);
  const ahora = tiempoSimuladoActual;
  
  // Diferencia en horas entre el vencimiento y el momento actual simulado
  const horasFaltantes = (vencimiento - ahora) / (1000 * 60 * 60);
  const alertasAEmitir = [];

  // Regla 1: Sin ingreso (Media) - Faltan < 10h y no ingresó al hub
  if (horasFaltantes <= 10 && !['INGRESADO_HUB', 'CLASIFICADO', 'EN_REPARTO', 'ENTREGA_FALLIDA'].includes(envio.estadoActual)) {
    if (!envio.alertasEmitidas.includes('SIN_INGRESO')) {
      alertasAEmitir.push({ regla: 'SIN_INGRESO', prioridad: 'Media' });
    }
  }

  // Regla 2: Sin salida (Alta) - Faltan < 4h y no está en reparto
  if (horasFaltantes <= 4 && !['EN_REPARTO', 'ENTREGA_FALLIDA'].includes(envio.estadoActual)) {
    if (!envio.alertasEmitidas.includes('SIN_SALIDA')) {
      alertasAEmitir.push({ regla: 'SIN_SALIDA', prioridad: 'Alta' });
    }
  }

  // Regla 3: Fallo en el día límite (Alta)
  const esMismoDia = vencimiento.toISOString().split('T')[0] === ahora.toISOString().split('T')[0];
  if (envio.estadoActual === 'ENTREGA_FALLIDA' && esMismoDia) {
    if (!envio.alertasEmitidas.includes('FALLO_DIA_LIMITE')) {
      alertasAEmitir.push({ regla: 'FALLO_DIA_LIMITE', prioridad: 'Alta' });
    }
  }

  // Regla 4: Vencido (Crítica) - Pasó el vencimiento
  if (horasFaltantes < 0) {
    if (!envio.alertasEmitidas.includes('VENCIDO')) {
      alertasAEmitir.push({ regla: 'VENCIDO', prioridad: 'Crítica' });
    }
  }

  // Emitir las alertas encontradas
  for (const alerta of alertasAEmitir) {
    envio.alertasEmitidas.push(alerta.regla);
    const eventoAlerta = {
      eventId: uuidv4(),
      shipmentId: shipmentId,
      tipo: 'ALERTA_ABIERTA',
      regla: alerta.regla,
      prioridad: alerta.prioridad,
      detectadoEn: ahora.toISOString()
    };

    await producer.send({
      topic: 'alertas.sla',
      messages: [{ key: shipmentId, value: JSON.stringify(eventoAlerta) }]
    });
    console.log(`⚠️ ALERTA [${alerta.prioridad}]: ${shipmentId} -> ${alerta.regla}`);
  }
}

async function cerrarAlertas(shipmentId) {
  const envio = estadoEnvios.get(shipmentId);
  if (envio && envio.alertasEmitidas.length > 0) {
    await producer.send({
      topic: 'alertas.sla',
      messages: [{ 
        key: shipmentId, 
        value: JSON.stringify({ eventId: uuidv4(), shipmentId, tipo: 'ALERTA_CERRADA', detectadoEn: tiempoSimuladoActual.toISOString() }) 
      }]
    });
    console.log(`✅ Alertas CERRADAS para ${shipmentId}`);
    envio.alertasEmitidas = [];
  }
}

async function iniciarMonitor() {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });
  await consumer.subscribe({ topic: 'envios.promesas', fromBeginning: true });

  console.log('✅ Monitor de SLA evaluando tiempos y estados...');

  // Evaluación continua: cada 1 segundo real (equivale a 2 minutos simulados aprox)
  setInterval(() => {
    for (const shipmentId of estadoEnvios.keys()) {
      evaluarRiesgoSLA(shipmentId).catch(console.error);
    }
  }, 1000);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const evento = JSON.parse(message.value.toString());
      const shipmentId = evento.shipmentId;
      
      if (!estadoEnvios.has(shipmentId)) {
        estadoEnvios.set(shipmentId, { estadoActual: null, venceEn: null, alertasEmitidas: [] });
      }
      const envio = estadoEnvios.get(shipmentId);

      // Sincronizar el reloj del monitor con el reloj acelerado de los eventos
      const tiempoEvento = new Date(evento.ocurridoEn || evento.venceEn);
      if (tiempoEvento > tiempoSimuladoActual) tiempoSimuladoActual = tiempoEvento;

      if (topic === 'envios.promesas') {
        envio.venceEn = evento.venceEn;
      } else if (topic === 'envios.estados') {
        envio.estadoActual = evento.tipo;
        if (evento.tipo === 'ENTREGADO') {
          await cerrarAlertas(shipmentId);
        }
      }

      // Evaluar riesgo inmediatamente al recibir un evento
      await evaluarRiesgoSLA(shipmentId);
    }
  });
}

iniciarMonitor().catch(console.error);