# NostalgiaTV# 📺 NostalgiaTV

NostalgiaTV es una aplicación de streaming retro personal que permite organizar y transmitir series y episodios a través de canales personalizados, con sincronización en tiempo real usando SignalR.

---

## 🚀 Tecnologías

### Backend
- **ASP.NET Core 10** — Web API REST
- **Entity Framework Core** — ORM con migraciones
- **SignalR** — Sincronización en tiempo real
- **SQL Server** — Base de datos
- **Serilog** — Logging estructurado
- **Mapster** — Mapeo de DTOs
- **FluentValidation** — Validación de modelos
- **JWT + Cookies HttpOnly** — Autenticación segura
- **Argon2id** — Hashing de contraseñas
- **Scalar** — Documentación de API

### Frontend
- **Angular 21** — Framework frontend
- **Angular Material** — Componentes UI
- **SignalR Client** — Sincronización en tiempo real
- **Daxa** — Template de dashboard Material Design

---

## 📋 Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [SQL Server](https://www.microsoft.com/sql-server) o SQL Server Express
- [Angular CLI](https://angular.io/cli)

---

## ⚙️ Instalación y configuración

### Backend

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/NostalgiaTV.git
cd NostalgiaTV
```

2. Configura `appsettings.Development.json` en `WebApi/WebApi/`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=NostalgiaTV;User ID=tu_usuario;Password=tu_password;TrustServerCertificate=True"
  },
  "Jwt": {
    "Key": "tu-clave-secreta-minimo-32-caracteres",
    "Issuer": "https://tu-dominio.com",
    "Audience": "https://tu-dominio.com"
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:4200"
    ]
  }
}
```

3. Aplica las migraciones:
```bash
cd WebApi/Infrastructure
dotnet ef database update --startup-project ../WebApi
```

4. Corre el backend:
```bash
cd WebApi/WebApi
dotnet run
```

La API estará disponible en `https://localhost:7221` y la documentación en `https://localhost:7221/scalar/v1`.

---

### Frontend

1. Instala dependencias:
```bash
cd WebApp
npm install
```

2. Configura el environment en `src/environments/environment.ts`:
```typescript
export const environment = {
    production: false,
    apiUrl: 'https://localhost:7221'
};
```

3. Corre el frontend:
```bash
npm start
```

La aplicación estará disponible en `http://127.0.0.1:54636`.

---

## 🏗️ Estructura del proyecto

```
NostalgiaTV/
├── WebApi/                         # Backend ASP.NET Core
│   ├── ApplicationCore/            # Entidades, DTOs, Interfaces, Excepciones
│   │   ├── DTOs/
│   │   ├── Entities/
│   │   ├── Exceptions/
│   │   └── Interfaces/
│   ├── Infrastructure/             # Servicios, Contexto, Migraciones
│   │   ├── BackgroundServices/
│   │   ├── Contexts/
│   │   ├── Migrations/
│   │   └── Services/
│   └── WebApi/                     # Controllers, Extensions, Program.cs
│       ├── Controllers/
│       ├── Extensions/
│       ├── Handlers/
│       └── Validators/
│
└── WebApp/                         # Frontend Angular
    └── src/
        └── app/
            ├── core/               # Guards, Interceptors, Servicios globales
            ├── features/
            │   ├── dashboard/      # Series, Episodes, Channels, Auth
            │   └── public/         # Home, Player
            ├── layouts/            # PublicLayout, DashboardLayout
            ├── shared/             # Modelos, Componentes compartidos, Dialogs
            └── common/             # Header, Sidebar, Footer
```

---

## 🔐 Credenciales por defecto

Al correr las migraciones se crea un usuario administrador por defecto:

| Campo    | Valor      |
|----------|------------|
| Username | `admin`    |
| Password | `Admin123!` |

> ⚠️ Cambia la contraseña después del primer inicio de sesión.

---

## 📡 Endpoints principales

| Método | Ruta                          | Descripción              |
|--------|-------------------------------|--------------------------|
| POST   | `/api/v1/auth/token`          | Login                    |
| POST   | `/api/v1/auth/refresh`        | Refresh token            |
| POST   | `/api/v1/auth/revoke`         | Logout                   |
| GET    | `/api/v1/series`              | Listar series            |
| POST   | `/api/v1/series`              | Crear serie              |
| PUT    | `/api/v1/series/{id}`         | Editar serie             |
| DELETE | `/api/v1/series/{id}`         | Eliminar serie           |
| GET    | `/api/v1/episodes/series/{id}`| Listar episodios         |
| POST   | `/api/v1/episodes`            | Crear episodio           |
| GET    | `/api/v1/channels`            | Listar canales           |
| POST   | `/api/v1/channels`            | Crear canal              |
| PUT    | `/api/v1/channels/{id}/series`| Asignar series al canal  |

---

## 📁 Variables de entorno sensibles

Las siguientes variables **nunca** deben subirse al repositorio:

- `ConnectionStrings:DefaultConnection`
- `Jwt:Key`
- Contraseñas de base de datos

Usa `appsettings.Development.json` localmente y variables de entorno del servidor en producción.

---

## 📄 Licencia

Copyright (c) 2026 Fernando. All rights reserved.

Este código es propietario y confidencial. No está permitido su uso, copia, modificación o distribución sin autorización expresa del autor.