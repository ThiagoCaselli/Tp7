# 📦 RutaSur - Arquitectura Orientada a Eventos

Este proyecto es la resolución del Trabajo Práctico de la cátedra de Programación Avanzada (2026). Implementa una plataforma de seguimiento de envíos en tiempo real para un operador de última milla, utilizando una arquitectura orientada a eventos (EDA).

## 🛠️ Stack Tecnológico
* **Message Broker:** Apache Kafka (modo KRaft)
* **Base de Datos (Read Model):** MongoDB (Replica Set para Change Streams)
* **Microservicios:** Node.js + KafkaJS
* **Frontend:** Next.js (App Router, Tailwind CSS, Server-Sent Events)
* **Infraestructura:** Docker & Docker Compose
* **Orquestador Local:** `concurrently` (para levantar todo con un solo comando)

---

## 🚀 Cómo levantar el proyecto paso a paso

### 1. Requisitos previos
Asegurate de tener instalados en tu máquina:
* [Node.js](https://nodejs.org/) (v18 o superior)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (debe estar ejecutándose)

### 2. Instalación de dependencias
Abrí una terminal en la carpeta raíz del proyecto y ejecutá:
```bash
npm install
cd frontend && npm install
cd ..
```

### 3. Levantar la infraestructura (Kafka y MongoDB)
Antes de iniciar el código, necesitamos que el broker de mensajería y la base de datos estén operativos. En la raíz del proyecto, ejecutá:
```bash
docker-compose up -d
```
> **Nota:** Esperá unos 10 a 15 segundos para que Kafka y el Replica Set de MongoDB terminen de inicializarse por completo.

### 4. Arrancar los microservicios y el frontend
Gracias al paquete `concurrently`, podés levantar los 6 microservicios y la interfaz de Next.js al mismo tiempo con un único comando:
```bash
npm start
```
Si todo está correcto, la consola mostrará los logs de colores de cada servicio conectándose a Kafka y los eventos del Simulador empezarán a fluir.

### 5. Acceder a las pantallas
Una vez que el comando anterior confirme que Next.js está "Ready", abrí tu navegador:
* **Torre de Control (General):** [http://localhost:3000](http://localhost:3000)
* **Panel de Demo (Control del simulador):** [http://localhost:3000/demo](http://localhost:3000/demo)
* **Tracking Público (Cliente):** [http://localhost:3000/tracking](http://localhost:3000/tracking)
* **Panel Analítico (Gerencia):** [http://localhost:3000/analitica](http://localhost:3000/analitica)
* **Detalle Supervisor:** `http://localhost:3000/envios/[ID_DEL_ENVIO]`

---

## 🧠 Arquitectura y Funcionamiento

El sistema se basa en el principio de **Coreografía de Microservicios**. Ningún servicio se comunica directamente mediante HTTP (REST); todo ocurre a través de tópicos en Apache Kafka.

1. **Simulador:** Emite eventos crudos (`CREADO`, `INGRESADO_HUB`, `EN_REPARTO`, etc.) al tópico `envios.estados`.
2. **Proyector (CU1):** Consume los eventos y proyecta el estado actual del envío en MongoDB (patrón CQRS).
3. **Reprogramación, Notificaciones y Analítica (CU2):** Tres grupos de consumidores independientes que reaccionan en paralelo a un evento de `ENTREGA_FALLIDA`.
4. **Monitor de SLA (CU3):** Evalúa constantemente el paso del tiempo frente a la promesa de entrega y emite alertas al tópico `alertas.sla`.
5. **Next.js (Frontend):** Se conecta a MongoDB mediante *Change Streams* (Server-Sent Events) para reflejar los cambios en la pantalla en tiempo real sin recargar la página.



