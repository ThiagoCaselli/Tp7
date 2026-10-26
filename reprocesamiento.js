const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'reprocesador', brokers: ['localhost:9092'] });

async function iniciarReprocesamiento() {
  // Le asignamos un ID de grupo totalmente nuevo para que Kafka le envíe desde el offset 0
  const consumer = kafka.consumer({ groupId: 'analitica-historica-v1' });
  await consumer.connect();
  
  // fromBeginning: true es la magia para demostrar el reprocesamiento
  await consumer.subscribe({ topic: 'envios.estados', fromBeginning: true });

  const tiemposEnvios = {}; // Memoria temporal para calcular la diferencia

  console.log('🔄 Iniciando reprocesamiento histórico desde el inicio del log...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const evento = JSON.parse(message.value.toString());
      const id = evento.shipmentId;

      if (evento.tipo === 'INGRESADO_HUB') {
        tiemposEnvios[id] = { hubId: evento.hubId, ingreso: new Date(evento.ocurridoEn).getTime() };
      }

      if (evento.tipo === 'EN_REPARTO' && tiemposEnvios[id]) {
        const salida = new Date(evento.ocurridoEn).getTime();
        const diferenciaMinutos = (salida - tiemposEnvios[id].ingreso) / 60000;
        const hubId = tiemposEnvios[id].hubId;

        console.log(`📊 [Reprocesado] ${id} en ${hubId} tardó: ${diferenciaMinutos.toFixed(2)} min`);
        
        // Limpiamos memoria
        delete tiemposEnvios[id]; 
      }
    },
  });
}

iniciarReprocesamiento().catch(console.error);