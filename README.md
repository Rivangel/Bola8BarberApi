# 🎱 Bola 8 Barbería — Bot de WhatsApp para Citas

Bot conversacional de WhatsApp para agendar, reagendar y cancelar citas en
**Bola 8 Barbería**. Incluye una API REST de administración y recordatorios
automáticos. Todos los mensajes están en **español (México)**.

## ✨ Características

- 💬 **Flujo conversacional** completo por WhatsApp (máquina de estados):
  agendar, reagendar, cancelar y consultar citas.
- 🗓️ **Disponibilidad inteligente**: horarios de 09:00 a 19:00 cada 30 min,
  saltando los espacios ya ocupados según la duración del servicio.
- 🔔 **Recordatorios automáticos**: 24 horas y 2 horas antes de cada cita.
- 🛠️ **API REST** para administrar citas y clientes.
- 🔒 **Verificación de firma** `x-hub-signature-256` y saneamiento de entrada.
- 🧯 **Manejo de errores**: ante cualquier fallo se reinicia la conversación y se
  envía un mensaje amable.

## 🧱 Stack tecnológico

| Componente      | Tecnología                       |
| --------------- | -------------------------------- |
| Runtime         | Node.js + Express.js             |
| Lenguaje        | TypeScript                       |
| WhatsApp        | Meta WhatsApp Cloud API (oficial)|
| Base de datos   | PostgreSQL + Prisma ORM (v7)     |
| Tareas (cron)   | node-cron                        |
| Configuración   | dotenv                           |

## 📁 Estructura del proyecto

```
/index.ts                 → punto de entrada (Express + arranque del scheduler)
/prisma.config.ts         → configuración de Prisma 7 (URL de migraciones)
/src
  /config                 → carga y validación de variables de entorno
  /routes                 → definición de rutas Express
  /controllers            → controladores (HTTP ↔ servicios)
  /services               → WhatsApp API, plantillas, disponibilidad, dominio
  /bot                    → máquina de estados de la conversación e intenciones
  /jobs                   → scheduler de recordatorios (node-cron)
  /middleware             → verificación de firma del webhook
  /utils                  → helpers de fecha y validadores
  /prisma                 → schema.prisma, client (adapter) y seed.ts
.env.example
```

## 🚀 Puesta en marcha

### 1. Requisitos previos

- Node.js 18+ y npm
- PostgreSQL en ejecución (local o en la nube)
- Una cuenta de [Meta for Developers](https://developers.facebook.com/)
- [ngrok](https://ngrok.com/) (para exponer el webhook en desarrollo)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el ejemplo y completa los valores:

```bash
cp .env.example .env
```

| Variable                   | Descripción                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`             | Cadena de conexión a PostgreSQL                                    |
| `WHATSAPP_TOKEN`           | Token (permanente o temporal) de la app de WhatsApp Cloud API      |
| `WHATSAPP_PHONE_NUMBER_ID` | **Phone Number ID** del número de WhatsApp (no el número en sí)     |
| `WHATSAPP_VERIFY_TOKEN`    | Token de verificación que tú defines y registras en Meta           |
| `WHATSAPP_APP_SECRET`      | App Secret de Meta (valida la firma `x-hub-signature-256`)          |
| `PORT`                     | Puerto del servidor (por defecto 3000)                             |
| `TZ`                       | Zona horaria (por defecto `America/Mexico_City`)                   |

> Si dejas `WHATSAPP_APP_SECRET` vacío, se **omite** la verificación de firma
> (cómodo en desarrollo, **no recomendado en producción**).

### 4. Preparar la base de datos

```bash
# Genera el cliente de Prisma
npm run prisma:generate

# Crea las tablas (migración inicial)
npm run prisma:migrate

# Inserta datos iniciales: 3 barberos y 5 servicios
npm run seed
```

### 5. Ejecutar

```bash
# Desarrollo (recarga en caliente)
npm run dev

# Producción
npm run build
npm start
```

Verás algo como:

```
🚀 Servidor escuchando en el puerto 3000
⏰ Programador de recordatorios iniciado (TZ: America/Mexico_City).
```

## 🌐 Exponer el webhook con ngrok

Meta necesita una URL pública HTTPS. En otra terminal:

```bash
ngrok http 3000
```

Copia la URL `https://XXXX.ngrok-free.app`. Tu webhook será:

```
https://XXXX.ngrok-free.app/webhook
```

## ⚙️ Configurar la app en Meta

1. Entra a [developers.facebook.com](https://developers.facebook.com/) →
   **Mis Apps** → crea una app de tipo **Business**.
2. Agrega el producto **WhatsApp**.
3. En **WhatsApp → API Setup** obtén:
   - **Temporary access token** → `WHATSAPP_TOKEN`
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - Agrega tu número personal como destinatario de prueba.
4. En **App settings → Basic** copia el **App Secret** → `WHATSAPP_APP_SECRET`.
5. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://XXXX.ngrok-free.app/webhook`
   - **Verify token**: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
   - Pulsa **Verify and save** (debe verse `✅ Webhook verificado por Meta` en la
     consola).
   - En **Webhook fields**, suscríbete a **messages**.
6. Escribe `hola` al número de prueba desde tu WhatsApp. 🎉

> El token temporal de Meta dura 24 h. Para producción genera un
> [token permanente](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started)
> con un usuario de sistema.

## 💬 Flujo de conversación

El bot detecta intenciones por palabras clave:

| Escribe                       | Acción                          |
| ----------------------------- | ------------------------------- |
| `agendar`, `cita`, `turno`    | Inicia el agendado              |
| `reagendar`, `cambiar`        | Reagenda una cita               |
| `cancelar`                    | Cancela una cita                |
| `mis citas`, `mis turnos`     | Muestra tus próximas citas      |
| `hola`, `buenas`, cualquiera  | Menú de bienvenida              |
| `menú`, `salir`               | Aborta el flujo y vuelve al menú|

**Pasos del agendado** (estado en `Conversacion.estado`):

1. `ESPERANDO_SERVICIO` — lista numerada de servicios con precios
2. `ESPERANDO_BARBERO` — barberos disponibles o "sin preferencia"
3. `ESPERANDO_FECHA` — fecha `DD/MM/AAAA` (rechaza fechas pasadas)
4. `ESPERANDO_HORA` — horarios disponibles del día/barbero
5. `ESPERANDO_NOMBRE` — nombre del cliente (si es nuevo)
6. `CONFIRMAR_CITA` — resumen y `SÍ`/`NO`

Al confirmar, se guarda la cita y se envía el mensaje de confirmación.

## 🔌 API REST

Base: `http://localhost:3000`

### Citas

| Método   | Ruta                          | Descripción                                     |
| -------- | ----------------------------- | ----------------------------------------------- |
| `POST`   | `/api/citas`                  | Crear cita manualmente                          |
| `GET`    | `/api/citas?fecha=YYYY-MM-DD` | Listar citas por fecha                          |
| `PUT`    | `/api/citas/:id`              | Actualizar (reagendar o cambiar estado)         |
| `DELETE` | `/api/citas/:id`              | Cancelar cita (estado = `CANCELADA`)            |

**Crear cita** (`POST /api/citas`):

```json
{
  "telefono": "5215512345678",
  "nombre": "Juan Pérez",
  "barberoId": 1,
  "servicioId": 2,
  "fecha": "25/06/2026",
  "horaInicio": "14:00"
}
```

> También puedes enviar `clienteId` en lugar de `telefono` + `nombre`.
> `horaFin` se calcula automáticamente según la duración del servicio.

**Actualizar cita** (`PUT /api/citas/:id`) — reagendar o cambiar estado:

```json
{ "fecha": "26/06/2026", "horaInicio": "16:00" }
```

```json
{ "estado": "COMPLETADA" }
```

### Clientes

| Método | Ruta                                     | Descripción                  |
| ------ | ---------------------------------------- | ---------------------------- |
| `GET`  | `/api/clientes`                          | Listar todos los clientes    |
| `GET`  | `/api/clientes/:telefono/historial`      | Historial de citas del cliente|

## 🔔 Recordatorios

`node-cron` ejecuta dos tareas (en la zona horaria configurada):

- **Diario a las 09:00** — recordatorio 24 h para las citas confirmadas de mañana.
- **Cada hora en punto** — recordatorio 2 h para las citas que comienzan dentro de
  ~2 horas (ventana de 60 min centrada en las 2 h, para no duplicar avisos).

## 🗃️ Modelo de datos

- **Cliente** — `id`, `nombre`, `telefono` (único), `createdAt`
- **Barbero** — `id`, `nombre`, `activo`
- **Servicio** — `id`, `nombre`, `duracionMinutos`, `precio`
- **Cita** — `id`, `clienteId`, `barberoId`, `servicioId`, `fecha`, `horaInicio`,
  `horaFin`, `estado` (`PENDIENTE`/`CONFIRMADA`/`CANCELADA`/`COMPLETADA`), `creadaEn`
- **Conversacion** — `id`, `telefono`, `estado`, `datosTemp` (JSON), `actualizadaEn`

## 📜 Scripts de npm

| Script                   | Acción                                  |
| ------------------------ | --------------------------------------- |
| `npm run dev`            | Servidor en modo desarrollo             |
| `npm run build`          | Compila TypeScript a `dist/`            |
| `npm start`              | Ejecuta la versión compilada            |
| `npm run prisma:generate`| Genera el cliente de Prisma             |
| `npm run prisma:migrate` | Aplica migraciones (desarrollo)         |
| `npm run prisma:deploy`  | Aplica migraciones (producción)         |
| `npm run seed`           | Siembra barberos y servicios iniciales  |

## 📝 Notas

- Jornada laboral: **09:00 a 19:00**, slots cada **30 minutos**.
- Las citas `PENDIENTE` y `CONFIRMADA` ocupan la agenda del barbero.
- En "sin preferencia" se asigna automáticamente un barbero libre.

---

💈 Hecho con cariño para **Bola 8 Barbería**.
