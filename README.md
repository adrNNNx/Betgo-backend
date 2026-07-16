# 🎰 BetGo — Backend

API REST del sistema BetGo (entretenimiento para bares): bares, jugadas, pozo global,
premios, staff y transacciones.

**Stack:** NestJS 11 · PostgreSQL 16 · Sequelize (sequelize-typescript) · JWT · Cloudinary

---

## 📋 Requisitos previos

| Requisito | Versión | Notas |
|---|---|---|
| **Node.js** | 20+ | La imagen Docker usa `node:20-alpine` |
| **npm** | 10+ | Viene con Node 20 |
| **Docker Desktop** | — | Corriendo, para PostgreSQL |

---

## 🗂️ Estructura del proyecto

Este repo es **una pieza** de un conjunto de repos hermanos. PostgreSQL **no vive acá**,
vive en `infra/`:

```
Betgo/
├── infra/                 ← PostgreSQL + script de schema inicial
│   ├── docker-compose.yml
│   └── init-db/
├── betgo-backend/         ← estás acá (API NestJS)
├── betgo-admin/           ← panel de administración (Next.js)
├── betgo-mozos/           ← panel de mozos
└── betgo-usuarios/        ← app de jugadores
```

> ⚠️ El `docker-compose.yml` de **este** repo solo construye el backend. Espera que la red
> `betgo_network` y el contenedor `betgo_postgres` ya existan (los crea `infra/`).

---

## 🚀 Puesta en marcha (paso a paso)

### Paso 1 — Crear la red y el volumen de Docker

Ambos están declarados como `external: true`, así que hay que crearlos **a mano la primera vez**:

```bash
docker network create betgo_network
docker volume create betgo_postgres_data
```

### Paso 2 — Levantar PostgreSQL

```bash
cd ../infra
docker-compose up -d
```

Verificar que quedó sano:

```bash
docker ps --filter name=betgo_postgres
docker-compose logs -f postgres
```

> El script `infra/init-db/01_schema.sql` (tablas, tipos ENUM, extensión `pgcrypto`) se ejecuta
> **solo la primera vez** que se crea el contenedor, cuando el volumen está vacío.

### Paso 3 — Configurar variables de entorno

```bash
cd ../betgo-backend
cp .env.example .env
```

Editar `.env`. Lo **mínimo** para arrancar en local:

```bash
DB_PASSWORD=betgo_secret_2026      # debe coincidir con el POSTGRES_PASSWORD de infra
JWT_SECRET=<una cadena de 32+ caracteres>
```

Las credenciales por defecto de `infra/docker-compose.yml` son:

| Variable | Valor por defecto |
|---|---|
| `DB_USERNAME` | `betgo` |
| `DB_PASSWORD` | `betgo_secret_2026` |
| `DB_DATABASE` | `betgo_db` |
| `DB_PORT` | `5432` |

Si vas a subir imágenes (logos de bares, símbolos, banners, premios), completá también las
variables de **Cloudinary**. Sin ellas la app levanta igual, pero los endpoints de upload fallan.

### Paso 4 — Instalar dependencias

```bash
npm install
```

### Paso 5 — Correr las migraciones

**Obligatorio.** El proyecto usa `synchronize: false`: Sequelize **nunca** toca el schema solo.
El `01_schema.sql` crea la base y las migraciones aplican todos los cambios posteriores.

```bash
npm run migration:run
npm run migration:status   # verificar que quedaron todas en "up"
```

### Paso 6 — Levantar el backend

```bash
npm run start:dev
```

La API queda en **http://localhost:3000/api** (hay un prefijo global `api`).

### Paso 7 — Verificar que funciona

El pozo global es público, sirve de smoke test:

```bash
curl http://localhost:3000/api/global-pool
```

Debería devolver un JSON con `currentAmount`, `costPerPlay`, etc.

### Paso 8 — Crear un usuario admin

No hay seeders. Los registros nuevos nacen con rol `player`, así que para usar el panel
hay que promover uno a `admin` a mano:

```bash
# 1) Registrarse por la API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"0981234567","password":"Admin1234","confirmPassword":"Admin1234","name":"Admin"}'

# 2) Promoverlo a admin
docker exec -it betgo_postgres psql -U betgo -d betgo_db \
  -c "UPDATE users SET role = 'admin' WHERE phone = '+595981234567';"
```

> El teléfono se normaliza a formato `+595XXXXXXXXX` al guardarse (ver `src/common/utils/phone.util.ts`).

Ahora podés loguearte y obtener el token:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0981234567","password":"Admin1234"}'
```

---

## 🐳 Alternativa: correr el backend en Docker

En vez de los pasos 4–6 (requiere los pasos 1–3 igual):

```bash
docker-compose up -d --build
docker-compose logs -f backend
```

Esto usa tu `.env`, pero **sobreescribe `DB_HOST=betgo_postgres`** para resolver el contenedor
por la red de Docker. Las migraciones corren solas al arrancar (ver el `CMD` del `Dockerfile`).

---

## ⚙️ Variables de entorno

| Variable | Requerida | Default | Descripción |
|---|:---:|---|---|
| `NODE_ENV` | — | `development` | En `development` loguea las queries SQL |
| `PORT` | — | `3000` | Puerto de la API |
| `DB_HOST` | — | `localhost` | En Docker: `betgo_postgres` |
| `DB_PORT` | — | `5432` | |
| `DB_USERNAME` | — | `betgo` | |
| `DB_PASSWORD` | ✅ | — | Debe coincidir con el de `infra` |
| `DB_DATABASE` | — | `betgo_db` | |
| `DB_DATABASE_TEST` | — | `betgo_db_test` | Solo para el entorno `test` |
| `JWT_SECRET` | ✅ | — | Mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | — | `15m` | Vida del access token |
| `JWT_REFRESH_EXPIRES_IN` | — | `7d` | Vida del refresh token |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | — | `60` / `10` | Rate limiting |
| `APP_URL` | — | `http://localhost:4200` | Base de las URLs de los QR |
| `FORCE_WIN` | — | `false` | Solo testing: fuerza que la jugada gane |
| `CLOUDINARY_CLOUD_NAME` | ⚠️ | — | Requerida para subir imágenes |
| `CLOUDINARY_API_KEY` | ⚠️ | — | Idem |
| `CLOUDINARY_API_SECRET` | ⚠️ | — | Idem |
| `CLOUDINARY_*_FOLDER` | — | `betgo/<tipo>` | Carpeta por tipo (bars, symbols, banners, prizes) |

---

## 🛠️ Comandos útiles

### Aplicación

```bash
npm run start:dev      # desarrollo con watch
npm run start:debug    # con debugger
npm run build          # compilar a dist/
npm run start:prod     # correr el build
npm run lint           # eslint --fix
npm run format         # prettier
npm test               # tests unitarios
npm run test:cov       # con cobertura
```

### Migraciones

```bash
npm run migration:run                        # aplicar pendientes
npm run migration:status                     # ver estado
npm run migration:revert                     # revertir la última
npm run migration:generate -- nombre-cambio  # crear una nueva
```

> Las migraciones viven en `src/database/migrations/` (ver `.sequelizerc`).
> **Todo cambio de schema necesita una migración**, no alcanza con tocar la entidad.

### Docker

```bash
# PostgreSQL (desde infra/)
docker-compose up -d              # iniciar
docker-compose down               # detener (conserva los datos)
docker-compose logs -f postgres   # ver logs
docker-compose restart postgres   # reiniciar

# Entrar a la base
docker exec -it betgo_postgres psql -U betgo -d betgo_db
```

---

## 🧯 Problemas frecuentes

**`network betgo_network not found`**
No creaste la red. Ver Paso 1.

**`volume betgo_postgres_data not found`**
Idem, el volumen también es externo: `docker volume create betgo_postgres_data`.

**`password authentication failed for user "betgo"`**
El `DB_PASSWORD` de tu `.env` no coincide con el del contenedor. Si ya creaste el volumen con
otra contraseña, la de Postgres no cambia sola: hay que recrear el volumen (⚠️ borra los datos):

```bash
cd ../infra && docker-compose down
docker volume rm betgo_postgres_data && docker volume create betgo_postgres_data
docker-compose up -d
```

**`relation "..." does not exist` / faltan columnas**
Faltan migraciones: `npm run migration:run`.

**El puerto 5432 ya está en uso**
Tenés otro Postgres local. Cambiá `DB_PORT` en el `.env` (el compose de infra lo respeta con
`${DB_PORT:-5432}`) o parás el servicio que lo ocupa.

**404 en todos los endpoints**
Falta el prefijo: es `/api/...`, no `/...` (ej. `http://localhost:3000/api/auth/login`).

**CORS bloqueado desde el front**
`src/main.ts` permite solo `localhost:4200` y `127.0.0.1:4200`. Si tu front corre en otro
puerto, agregalo ahí.

---

## 📚 Notas de arquitectura

- **Prefijo global `api`** y validación con `ValidationPipe` (`whitelist: true`, `transform: true`) — ver `src/main.ts`.
- **Guards globales**: `JwtAuthGuard` + `RolesGuard`. Todo endpoint pide JWT salvo que tenga `@Public()`; con `@Roles(UserRole.ADMIN)` se restringe por rol.
- **Dinero con `decimal.js`**: los montos nunca se calculan con floats (recargas, distribución del pozo, ajustes).
- **`synchronize: false`**: el schema se maneja exclusivamente por migraciones.
- **Zona horaria**: las jugadas diarias usan `America/Asuncion` (`src/common/utils/timezone.util.ts`).
