# Reclutamiento — Estación Kus Medios

Formulario público de reclutamiento (reporteros, locutores, moderación,
producción, redes):
https://reclutamiento.estacionkusmedios.com/

## Stack

- **Front:** `index.html` estático (todo en un archivo), GitHub Pages desde
  `main`, dominio custom por CNAME en el DNS de Microsoft 365.
- **Backend:** Supabase.
  - Tabla `recruitment_applications` (esquema en `supabase/recruitment.sql`):
    RLS activado, sin acceso para rol `anon` (verificado).
  - Edge function `supabase/functions/submit-application`: valida campos,
    limita solicitudes por IP y por día, guarda la solicitud y avisa por
    correo vía Brevo a hola@estacionkusmedios.com.
  - **Secretos SOLO por variables de entorno** de la edge function
    (`SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `RECRUITMENT_IP_SALT`).
    Nunca van en el repo.

## Deploy

- Sitio: push a `main` (GitHub Pages).
- Edge function: `supabase functions deploy submit-application` desde la CLI
  de Supabase con el proyecto enlazado.
- Cambios de esquema: aplicar `supabase/recruitment.sql` en el SQL Editor.

## Notas

- CORS restringido a https://reclutamiento.estacionkusmedios.com.
- Anti-spam: honeypot, límite de 3 solicitudes/hora por IP y 150/día global.
