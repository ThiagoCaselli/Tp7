const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');

const kafka = new Kafka({ clientId: 'simulador-rutasur', brokers: ['localhost:9092'] });
const producer = kafka.producer();

const FACTOR_ACELERACION = 120;
const INICIO_REAL = Date.now();

function getTiempoSimulado() {
  const deltaReal = Date.now() - INICIO_REAL;
  return new Date(INICIO_REAL + (deltaReal * FACTOR_ACELERACION)).toISOString();
}

function crearEvento(shipmentId, tipo, secuencia, opciones = {}) {
  return {
    eventId: uuidv4(),
    shipmentId,
    tipo,
    ocurridoEn: getTiempoSimulado(),
    secuencia,
    hubId: opciones.hubId || 'HUB-CENTRAL',
    zonaId: opciones.zonaId || 'ZONA-NORTE',
    repartidorId: opciones.repartidorId || 'REP-101',
    version: 1,
    motivo: opciones.motivo || null
  };
}

function crearPromesa(shipmentId) {
  const fecha = new Date(getTiempoSimulado());
  fecha.setHours(fecha.getHours() + 24); 
  return { eventId: uuidv4(), shipmentId, venceEn: fecha.toISOString(), version: 1 };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function publicarEvento(evento) {
  await producer.send({
    topic: 'envios.estados',
    messages: [{ key: evento.shipmentId, value: JSON.stringify(evento) }],
  });
  console.log(`[${evento.ocurridoEn}] 📦 ${evento.shipmentId} -> ${evento.tipo}`);
}

async function publicarPromesa(promesa) {
  await producer.send({
    topic: 'envios.promesas',
    messages: [{ key: promesa.shipmentId, value: JSON.stringify(promesa) }],
  });
}

// Lógica de simulación adaptada para soportar escenarios forzados
async function simularViaje(shipmentId, escenario = 'NORMAL') {
  let secuencia = 1;

  await publicarEvento(crearEvento(shipmentId, 'CREADO', secuencia++));
  await publicarPromesa(crearPromesa(shipmentId));
  await sleep(200);
  
  await publicarEvento(crearEvento(shipmentId, 'INGRESADO_HUB', secuencia++));
  
  // Escenario Demorado: forzamos la pausa para disparar alertas de SLA
  if (escenario === 'DEMORADO' || (escenario === 'NORMAL' && Math.random() < 0.10)) {
    console.log(`⏳ Simulando demora crítica en HUB para ${shipmentId}...`);
    await sleep(6000); 
  } else {
    await sleep(300);
  }
  
  await publicarEvento(crearEvento(shipmentId, 'CLASIFICADO', secuencia++));
  await sleep(400);

  // Lógica de intentos de entrega
  const simularIntento = async (motivoFallo = null) => {
    await publicarEvento(crearEvento(shipmentId, 'EN_REPARTO', secuencia++));
    await sleep(500);
    if (motivoFallo) {
      await publicarEvento(crearEvento(shipmentId, 'ENTREGA_FALLIDA', secuencia++, { motivo: motivoFallo }));
      await sleep(1000); // Pausa antes del próximo intento si lo hubiera
    } else {
      await publicarEvento(crearEvento(shipmentId, 'ENTREGADO', secuencia++));
    }
  };

  if (escenario === 'FELIZ') {
    await simularIntento(null);
  } else if (escenario === 'AUSENTE') {
    await simularIntento('AUSENTE');
  } else if (escenario === 'TERCER_FALLO') {
    await simularIntento('AUSENTE'); // Intento 1
    await simularIntento('AUSENTE'); // Intento 2
    await simularIntento('AUSENTE'); // Intento 3 (acá el servicio de reprogramación lo va a devolver)
  } else {
    // Flujo normal aleatorio
    if (Math.random() < 0.20) {
      const motivos = ['AUSENTE', 'DIRECCION_INCORRECTA', 'RECHAZADO', 'ZONA_INACCESIBLE'];
      const motivo = motivos[Math.floor(Math.random() * motivos.length)];
      await simularIntento(motivo);
    } else {
      await simularIntento(null);
    }
  }
}

async function iniciarSimulador() {
  await producer.connect();
  console.log('✅ Simulador conectado a Kafka.');

  // Flujo continuo en segundo plano (20 envíos por minuto)
  setInterval(() => {
    simularViaje(`ENV-AUTO-${Date.now()}`, 'NORMAL').catch(console.error);
  }, 3000);

  // --- API REST PARA EL PANEL DE DEMO ---
  const app = express();
  app.use(cors());

  app.post('/api/escenarios/:tipo', (req, res) => {
    const tipo = req.params.tipo.toUpperCase();
    
    if (tipo === 'RAFAGA') {
      console.log('🌪️ Disparando ráfaga de 500 envíos...');
      for (let i = 0; i < 500; i++) {
        simularViaje(`ENV-RAFAGA-${Date.now()}-${i}`, 'NORMAL').catch(console.error);
      }
      return res.json({ mensaje: 'Ráfaga disparada' });
    }

    const id = `ENV-${tipo}-${Date.now()}`;
    simularViaje(id, tipo).catch(console.error);
    res.json({ mensaje: `Escenario ${tipo} iniciado`, shipmentId: id });
  });

  app.listen(4000, () => {
    console.log('🎮 API de escenarios escuchando en http://localhost:4000');
  });
}

iniciarSimulador().catch(console.error);