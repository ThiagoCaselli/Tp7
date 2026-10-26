'use client';
import { useState, useEffect } from 'react';

export default function TrackingPublico() {
  const [shipmentId, setShipmentId] = useState('');
  const [envio, setEnvio] = useState<any>(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscarEnvio = async () => {
    setBuscando(true);
    setError('');
    setEnvio(null);
    
    try {
      const res = await fetch(`/api/tracking/${shipmentId}`);
      if (!res.ok) throw new Error('Envío no encontrado. Revisá el código.');
      
      const data = await res.json();
      setEnvio(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  };

  // Nos colgamos del mismo change stream de envíos para actualizar la vista en vivo
  useEffect(() => {
    if (!envio) return;

    const eventSource = new EventSource('/api/envios');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.operationType === 'update' || data.operationType === 'insert') {
        const envioActualizado = data.fullDocument; 
        if (envioActualizado && envioActualizado.shipmentId === envio.shipmentId) {
          setEnvio(envioActualizado);
        }
      }
    };

    return () => eventSource.close();
  }, [envio?.shipmentId]);

  return (
    <main className="p-8 bg-gray-50 min-h-screen text-gray-900 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-blue-600 text-center">RutaSur Tracking 📦</h1>
        <p className="text-center text-gray-500 mb-8">Seguí tu paquete en tiempo real</p>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Ingresá tu código (ej: ENV-...)" 
              className="flex-1 p-3 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
            />
            <button 
              onClick={buscarEnvio}
              disabled={buscando || !shipmentId}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-bold transition disabled:opacity-50"
            >
              {buscando ? 'Buscando...' : 'Rastrear'}
            </button>
          </div>
          {error && <p className="text-red-500 mt-4 text-center font-semibold">{error}</p>}
        </div>

        {envio && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <div className="mb-6 border-b pb-4">
              <p className="text-sm text-gray-500 uppercase tracking-wide">Estado actual</p>
              <h2 className="text-2xl font-black text-gray-800 mt-1">{envio.estadoActual?.replace('_', ' ')}</h2>
            </div>
            
            <div className="mb-6 border-b pb-4">
              <p className="text-sm text-gray-500 uppercase tracking-wide">Fecha estimada de entrega</p>
              {/* Ocultamos detalles internos pero mostramos la promesa */}
              <p className="text-lg font-medium text-gray-700 mt-1">
                {envio.historial?.find((e: any) => e.venceEn) 
                  ? new Date(envio.historial.find((e: any) => e.venceEn).venceEn).toLocaleString()
                  : 'Calculando...'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide mb-4">Historial público</p>
              <ul className="space-y-4">
                {/* Filtramos eventos técnicos (como DECISION_SISTEMA) para no asustar al cliente */}
                {envio.historial
                  ?.filter((e: any) => e.tipo !== 'PROMESA_GENERADA' && e.tipo !== 'DECISION_SISTEMA')
                  .reverse()
                  .map((evento: any, i: number) => (
                  <li key={i} className="flex gap-4 items-start">
                    <div className="w-3 h-3 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                    <div>
                      <p className="font-semibold text-gray-800">{evento.tipo?.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-500">{new Date(evento.ocurridoEn).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}