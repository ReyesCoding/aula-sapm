# WebColegio – Guía rápida de QA (Postman)

## 1) Variables de entorno (Postman)
Crea un **Environment** en Postman con:
- `baseUrl` = `http://localhost:3001`
- `adminEmail` = `admin@webcolegio.com`
- `centerEmail` = `centro@webcolegio.com`
- `teacherEmail` = `maestro@webcolegio.com`
- `student1Email` = `juan@webcolegio.com`
- `student2Email` = `ana@webcolegio.com`
- `parentEmail` = `padre@webcolegio.com`
- `password` = `123456`  
- `token` = *(se rellenará tras login)*

> Tip: Si Postman te ofrece importar `.env` de VS Code, puedes rechazarlo y usar este Environment manual.

## 2) Login por rol (obtener token)
`POST {{baseUrl}}/auth/login`
```json
{
  "email": "{{adminEmail}}",
  "password": "{{password}}"
}
