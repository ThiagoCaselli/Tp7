'use client';
import { useState, useEffect } from 'react';

export default function PanelAnalitico() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [zonaFiltro, setZonaFiltro] = useState('');
  
  const cargarDatos = async () => {
    const url = zonaFiltro ? `/api/analitica?zonaId=${zonaFiltro}` : '/api/analitica';
    const res = await fetch(url);
    const data = await res.json();
    setMetricas(data);
  };

  useEffect(() => {
    cargarDatos();
  }, [zonaFiltro]);

  const totalFallos = metricas.reduce((acc, curr) => acc + (curr.totalFallos || 0), 0);
  
  const motivosTotales = metricas.reduce((acc, curr) => {
    if (curr.motivos) {
      for (const [motivo, cantidad] of Object.entries(curr.motivos)) {
        acc[motivo] = (acc[motivo] || 0) + (cantidad as number);
      }
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="p-8 bg-gray-100 min-h-screen text-gray-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-indigo-700">RutaSur - Panel Analítico 📊</h1>
        <p className="text-gray-600 mb-8">Decisiones de mejora basadas en eventos (CU4)</p>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-8 flex gap-4 items-center">
          <label className="font-semibold text-gray-700">Filtrar por Zona:</label>
          <select 
            className="p-2 border rounded"
            value={zonaFiltro}
            onChange={(e) => setZonaFiltro(e.target.value)}
          >
            <option value="">Todas las zonas</option>
            <option value="ZONA-NORTE">Zona Norte</option>
            <option value="ZONA-SUR">Zona Sur</option>
          </select>
          <button onClick={cargarDatos} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded hover:bg-indigo-200">
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Tarjeta de Total de Fallos */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col justify-center items-center">
            <h2 className="text-lg text-gray-500 font-semibold uppercase tracking-wider mb-2">Total Entregas Fallidas</h2>
            <p className="text-6xl font-black text-indigo-600">{totalFallos}</p>
            <p className="text-sm text-gray-400 mt-4 text-center">Incrementos atómicos procesados en tiempo real por el grupo `analitica`</p>
          </div>

          {/* Distribución de motivos */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg text-gray-500 font-semibold uppercase tracking-wider mb-6">Distribución de Motivos</h2>
            {Object.keys(motivosTotales).length === 0 ? (
              <p className="text-gray-400 italic">No hay datos registrados aún.</p>
            ) : (
              <ul className="space-y-4">
                {/* Forzamos el tipo explícitamente para evitar conflictos con TypeScript */}
                {(Object.entries(motivosTotales) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([motivo, cant]) => (
                  <li key={motivo}>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold text-gray-700">{motivo.replace('_', ' ')}</span>
                      <span className="font-bold text-indigo-600">{cant}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${totalFallos > 0 ? (cant / totalFallos) * 100 : 0}%` }}></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Tabla cruda de métricas diarias */}
        <div className="mt-8 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="p-4 font-semibold">Fecha</th>
                <th className="p-4 font-semibold">Zona</th>
                <th className="p-4 font-semibold">Franja Horaria</th>
                <th className="p-4 font-semibold text-right">Fallos Totales</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((m) => (
                <tr key={m._id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{m.fecha}</td>
                  <td className="p-4 font-mono text-sm">{m.zonaId}</td>
                  <td className="p-4">{m.franja}</td>
                  <td className="p-4 text-right font-bold text-indigo-600">{m.totalFallos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}