'use client';
import { useState } from 'react';

export default function PanelDeDemo() {
  const [mensaje, setMensaje] = useState<string>('');

  const dispararEscenario = async (tipo: string) => {
    setMensaje(`Disparando escenario: ${tipo}...`);
    try {
      // Le pegamos a la API que expone el simulador en el puerto 4000
      const res = await fetch(`http://localhost:4000/api/escenarios/${tipo}`, {
        method: 'POST',
      });
      const data = await res.json();
      setMensaje(`✅ Éxito: ${data.mensaje} ${data.shipmentId ? `(ID: ${data.shipmentId})` : ''}`);
    } catch (error) {
      setMensaje(`❌ Error de conexión. ¿Está corriendo el simulador.js en el puerto 4000?`);
    }
  };

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-6 text-purple-400">RutaSur - Panel de Demo 🎮</h1>
      <p className="mb-8 text-gray-300">
        Utilizá estos botones para inyectar los escenarios obligatorios durante la defensa del trabajo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button onClick={() => dispararEscenario('FELIZ')} className="bg-green-600 hover:bg-green-500 text-white p-4 rounded-lg font-bold shadow-lg transition">
          📦 Envío Feliz
          <span className="block text-xs font-normal mt-1">Recorre todos los estados sin incidentes</span>
        </button>

        <button onClick={() => dispararEscenario('AUSENTE')} className="bg-yellow-600 hover:bg-yellow-500 text-white p-4 rounded-lg font-bold shadow-lg transition">
          🏠 Ausente
          <span className="block text-xs font-normal mt-1">Falla por ausencia y se reprograma</span>
        </button>

        <button onClick={() => dispararEscenario('DEMORADO')} className="bg-orange-600 hover:bg-orange-500 text-white p-4 rounded-lg font-bold shadow-lg transition">
          ⏳ Demorado
          <span className="block text-xs font-normal mt-1">Queda detenido en el hub (Fuerza alerta SLA)</span>
        </button>

        <button onClick={() => dispararEscenario('TERCER_FALLO')} className="bg-red-600 hover:bg-red-500 text-white p-4 rounded-lg font-bold shadow-lg transition">
          🚫 Tercer Fallo
          <span className="block text-xs font-normal mt-1">Agota los 3 intentos y pasa a devolución</span>
        </button>

        <button onClick={() => dispararEscenario('RAFAGA')} className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-lg font-bold shadow-lg transition col-span-1 md:col-span-2 lg:col-span-1">
          🌪️ Ráfaga (500 envíos)
          <span className="block text-xs font-normal mt-1">Prueba de carga y acumulación</span>
        </button>
      </div>

      {mensaje && (
        <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg text-center font-mono">
          {mensaje}
        </div>
      )}
    </main>
  );
}