'use client';
import { useEffect, useState } from 'react';

export default function TorreDeControl() {
  const [eventosEnVivo, setEventosEnVivo] = useState<string[]>([]);
  const [contadores, setContadores] = useState<Record<string, number>>({
    CREADO: 0, EN_REPARTO: 0, ENTREGADO: 0, ENTREGA_FALLIDA: 0
  });
  
  // Nuevo estado para la cola de alertas
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    // Stream de Envíos
    const eventSourceEnvios = new EventSource('/api/envios');
    eventSourceEnvios.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.operationType === 'update' || data.operationType === 'insert') {
        const envio = data.fullDocument; 
        if (envio) {
          setEventosEnVivo((prev) => {
            const hora = new Date().toLocaleTimeString();
            return [`[${hora}] 📦 ${envio.shipmentId} cambió a estado: ${envio.estadoActual}`, ...prev].slice(0, 10);
          });
          setContadores((prev) => ({
            ...prev,
            [envio.estadoActual]: (prev[envio.estadoActual] || 0) + 1
          }));
        }
      }
    };

    // Stream de Alertas
    const eventSourceAlertas = new EventSource('/api/alertas');
    eventSourceAlertas.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.operationType === 'update' || data.operationType === 'insert') {
        const alerta = data.fullDocument;
        if (alerta) {
          setAlertas((prev) => {
            // Si la alerta se cerró, la sacamos de la lista
            if (alerta.estado === 'CERRADA') {
              return prev.filter(a => a._id !== alerta._id);
            }
            
            // Si está abierta, la agregamos o actualizamos y reordenamos
            const sinActual = prev.filter(a => a._id !== alerta._id);
            const nuevaLista = [...sinActual, alerta];
            
            // Ordenamos por prioridad
            const pesoPrioridad: Record<string, number> = { 'Crítica': 3, 'Alta': 2, 'Media': 1 };
            return nuevaLista.sort((a, b) => (pesoPrioridad[b.prioridad] || 0) - (pesoPrioridad[a.prioridad] || 0));
          });
        }
      }
    };

    return () => {
      eventSourceEnvios.close();
      eventSourceAlertas.close();
    };
  }, []);

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">RutaSur - Torre de Control 🚚</h1>
      
      {/* Contadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {['CREADO', 'EN_REPARTO', 'ENTREGADO', 'ENTREGA_FALLIDA'].map((estado) => (
          <div key={estado} className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 text-center">
            <h3 className="text-sm text-gray-400 font-semibold">{estado.replace('_', ' ')}</h3>
            <p className="text-3xl font-bold text-white mt-2">{contadores[estado] || 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Eventos en vivo */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-green-400">🔴 Últimos Eventos</h2>
          {eventosEnVivo.length === 0 ? (
            <p className="text-gray-400 italic">Esperando eventos...</p>
          ) : (
            <ul className="space-y-2">
              {eventosEnVivo.map((ev, i) => (
                <li key={i} className="bg-gray-700 p-3 rounded text-sm font-mono border-l-4 border-blue-500 animate-pulse">
                  {ev}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cola de Alertas Priorizada */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-red-400">⚠️ Cola de Alertas (SLA)</h2>
          {alertas.length === 0 ? (
            <p className="text-gray-400 italic">No hay alertas activas en este momento.</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((alerta) => (
                <li key={alerta._id} className={`p-4 rounded border-l-4 ${alerta.prioridad === 'Crítica' ? 'bg-red-900 border-red-500' : alerta.prioridad === 'Alta' ? 'bg-orange-900 border-orange-500' : 'bg-yellow-900 border-yellow-500'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{alerta.shipmentId}</span>
                    <span className="text-sm font-semibold px-2 py-1 rounded bg-black/30">{alerta.prioridad}</span>
                  </div>
                  <p className="text-sm mt-1 text-gray-300">Regla: {alerta.regla}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}