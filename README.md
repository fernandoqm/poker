# 🎯 Estimaciones de Equipo - Planning Poker

Aplicación profesional de Planning Poker para estimaciones ágiles, diseñada para uso corporativo sin publicidad.

---

## 🚀 Inicio Rápido

### Abrir la Aplicación

**Opción 1: Archivo Local**
```
Abrir: index.html en cualquier navegador moderno
```

**Opción 2: Servidor Web**
```
Subir los archivos al servidor y acceder vía HTTP
```

---

## 📋 Características

- ✅ **Gestión de Participantes** con avatares personalizados
- ✅ **Tarjetas de Votación** Fibonacci (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕)
- ✅ **Ocultar/Mostrar Votos** para evitar sesgo
- ✅ **Estadísticas Automáticas** (promedio, mediana, total)
- ✅ **Persistencia Local** (los datos se guardan automáticamente)
- ✅ **Diseño Responsive** (funciona en móvil, tablet, desktop)
- ✅ **Sin Publicidad** ni distracciones

---

## 📖 Cómo Usar

1. **Agregar Participantes**: Clic en "Agregar Participante" e ingresar nombres
2. **Seleccionar Votante**: Clic en la tarjeta del participante activo
3. **Votar**: Clic en la tarjeta de estimación deseada
4. **Revelar**: Clic en "Mostrar Votos" cuando todos hayan votado
5. **Nueva Ronda**: Clic en "Limpiar Estimaciones" para empezar de nuevo

---

## 🎨 Personalización

### Colores Corporativos

Editar `styles.css` líneas 8-21:

```css
:root {
    --color-primary: #1a365d;  /* Color principal */
    --color-accent: #0d9488;   /* Color de acento */
}
```

### Logo de la Empresa

Reemplazar el ícono SVG en `index.html` línea 14 con:

```html
<img src="tu-logo.png" alt="Logo" class="app-icon">
```

---

## 🖥️ Despliegue en Servidor

### IIS (Windows)
```powershell
Copy-Item -Path ".\*" -Destination "C:\inetpub\wwwroot\estimaciones"
```

### Apache/Nginx (Linux)
```bash
cp -r ./* /var/www/html/estimaciones/
```

### Requisitos
- ✅ Solo servidor web estático (HTML/CSS/JS)
- ❌ No requiere PHP, Node.js, ni base de datos
- ❌ No requiere configuración especial

---

## 📁 Archivos

```
estimaciones/
├── index.html     # Estructura HTML
├── styles.css     # Estilos CSS
├── app.js         # Lógica JavaScript
└── README.md      # Este archivo
```

---

## 💾 Persistencia de Datos

Los datos se guardan automáticamente en **localStorage** del navegador:
- ✅ Participantes se mantienen al refrescar
- ✅ Votos persisten durante la sesión
- ⚠️ Cada navegador tiene su propia sesión (no hay sincronización entre dispositivos)

---

## 🔄 Escalabilidad Futura

Si necesitan colaboración en tiempo real entre múltiples dispositivos:
- Agregar backend Node.js con Socket.io
- Implementar base de datos para historial
- Crear sistema de salas con códigos únicos

---

## 📞 Soporte

Para personalización avanzada o nuevas funcionalidades, contactar al equipo de desarrollo.

---

## 📄 Licencia

Aplicación de uso interno corporativo.

---

**Versión**: 1.0  
**Última Actualización**: Enero 2026
