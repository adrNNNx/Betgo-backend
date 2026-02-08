# 🎰 BetGo - Configuración

## Requisitos Previos
- Docker Desktop instalado y corriendo
- Node.js 18+ instalado
- Proyecto de Nest.js inicializado

---

## Paso 1: Levantar PostgreSQL con Docker

### 1.1 Crear tu archivo .env a partir del ejemplo

```bash
cp .env.example .env
```

### 1.2 Levantar los contenedores

```bash
docker-compose up -d
```

## Paso 2: Instalar Dependencias

### 2.1 Instalar dependencias

```bash
npm install
```


## 🛠️ Comandos Útiles de Docker

```bash
# Iniciar contenedores
docker-compose up -d

# Detener contenedores (mantiene datos)
docker-compose down

# Detener y BORRAR datos (reiniciar desde cero)
docker-compose down -v

# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar solo postgres
docker-compose restart postgres

# Entrar a la BD
docker exec -it betgo_postgres psql -U betgo -d betgo_db
```

---

## 🌐 Acceso a pgAdmin (Opcional)

Si levantaste el servicio pgAdmin:

1. Abrir http://localhost:5050
2. Login: `admin@betgo.com` / `admin123`
3. Click derecho en "Servers" → "Register" → "Server"
4. Configurar:
   - **Name:** BetGo Local
   - **Host:** postgres (nombre del servicio en docker)
   - **Port:** 5432
   - **Username:** betgo
   - **Password:** betgo_secret_2026

---

## ⚠️ Notas Importantes

1. **Primera vez:** El script `01_schema.sql` se ejecuta SOLO la primera vez que se crea el contenedor. Si necesitas reiniciar desde cero:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

2. **Puerto ocupado:** Si el puerto 5432 está ocupado, cambia en docker-compose.yml:
   ```yaml
   ports:
     - "5433:5432"  # Cambia 5432 por 5433 u otro
   ```
   Y actualiza `DB_PORT=5433` en tu `.env`

---