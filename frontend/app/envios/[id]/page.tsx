'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';

// 1. Separamos el contenido principal en su propio componente
function DetalleEnvioContent() {
  const params = useParams();
  const shipmentId = params.id as string;
  
  const [envio, setEnvio] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shipmentId) return;

    fetch(`/api/envios/${shipmentId}`)
      .then(res => {
        if (!res.ok) throw new Error('No encontrado');
        return res.json();
      })
      .then(data => setEnvio(data))
      .catch(err => setError(err.message));

    const eventSourceEnvios = new EventSource('/api/envios');
    eventSourceEnvios.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.fullDocument && data.fullDocument.shipmentId === shipmentId) {
        setEnvio((prev: any) => ({ ...prev, ...data.fullDocument }));
      }
    };

    const eventSourceAlertas = new EventSource('/api/alertas');
    eventSourceAlertas.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.fullDocument && data.fullDocument.shipmentId === shipmentId) {
        fetch(`/api/envios/${shipmentId}`).then(res => res.json()).then(data => setEnvio(data));
      }
    };

    return () => {
      eventSourceEnvios.close();
      eventSourceAlertas.close();
    };
  }, [shipmentId]);

  if (error) return <div className="p-8 text-red-500 font-bold">Error: {error}</div>;
  if (!envio) return <div className="p-8 text-gray-500">Cargando datos internos...</div>;

  return (
    <main className="p-8 bg-slate-900 min-h-screen text-slate-200 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-emerald-400">Panel de Supervisor: {envio.shipmentId}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-slate-300 border-b border-slate-600 pb-2">Datos Operativos</h2>
            <p className="mb-2"><span className="text-slate-400">Estado:</span> <span className="font-bold text-white">{envio.estadoActual}</span></p>
            <p className="mb-2"><span className="text-slate-400">Hub:</span> <span className="font-mono">{envio.hubId}</span></p>
            <p className="mb-2"><span className="text-slate-400">Zona:</span> <span className="font-mono">{envio.zonaId}</span></p>
            <p className="mb-2"><span className="text-slate-400">Última Secuencia Aplicada:</span> <span className="font-mono text-emerald-400">{envio.ultimaSecuencia}</span></p>
          </div>

          <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-rose-400 border-b border-slate-600 pb-2">Alertas SLA Vinculadas</h2>
            {envio.alertasAsociadas?.length === 0 ? (
              <p className="text-slate-400 italic">No se registraron alertas para este paquete.</p>
            ) : (
              <ul className="space-y-3">
                {envio.alertasAsociadas?.map((alerta: any) => (
                  <li key={alerta._id} className="bg-slate-700 p-3 rounded flex justify-between items-center border-l-4 border-rose-500">
                    <div>
                      <p className="font-bold">{alerta.regla.replace('_', ' ')}</p>
                      <p className="text-sm text-slate-400">Estado: {alerta.estado}</p>
                    </div>
                    <span className="bg-slate-900 px-2 py-1 text-xs rounded text-rose-300 font-bold">{alerta.prioridad}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-6 text-sky-400 border-b border-slate-600 pb-2">Línea de Tiempo Cruda (Log de Eventos)</h2>
          <div className="space-y-4">
            {envio.historial?.slice().reverse().map((evento: any, i: number) => (
              <div key={i} className={`p-4 rounded border-l-4 flex flex-col gap-1 
                ${evento.tipo === 'ENTREGA_FALLIDA' ? 'bg-rose-900/30 border-rose-500' : 
                  evento.tipo === 'DECISION_SISTEMA' ? 'bg-amber-900/30 border-amber-500' : 
                  evento.tipo === 'NOTIFICACION_ENVIADA' ? 'bg-purple-900/30 border-purple-500' : 
                  'bg-slate-700 border-sky-500'}`}>
                
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">{evento.tipo}</span>
                  <span className="text-sm text-slate-400">{new Date(evento.ocurridoEn).toLocaleString()}</span>
                </div>
                
                {evento.motivo && <p className="text-sm text-rose-300">Motivo: {evento.motivo}</p>}
                {evento.resolucion && <p className="text-sm text-amber-300">Decisión de Reprogramación: {evento.resolucion}</p>}
                {evento.eventId && <p className="text-xs text-slate-500 font-mono mt-2">eventId: {evento.eventId}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

// 2. Exportamos la página principal envuelta en Suspense
export default function DetalleEnvioSupervisor() {
  return (
    <Suspense fallback={<div className="p-8 text-white font-bold bg-slate-900 min-h-screen">Cargando módulo de supervisor...</div>}>
      <DetalleEnvioContent />
    </Suspense>
  );
}