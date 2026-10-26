const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'inyector-dlq', brokers: ['localhost:9092'] });

async function inyectar() {
  const producer = kafka.producer();
  await producer.connect();
  
  // Enviamos un evento a propósito sin los campos obligatorios (sin shipmentId ni tipo)
  await producer.send({
    topic: 'envios.estados',
    messages: [{
      key: 'ENV-ERROR-999',
      value: JSON.stringify({ 
        evento_roto: true, 
        motivo: "Faltan todos los campos obligatorios" 
      })
    }]
  });
  
  console.log('💥 Evento malformado inyectado al topic envios.estados');
  await producer.disconnect();
}

inyectar().catch(console.error);