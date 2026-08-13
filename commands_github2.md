
# PUBLICAR EN GITHUB PAGES

## 1. Subir los cambios

```bash
git add .
git commit -m "Publicar sitio"
git push origin main
```

No hace falta volver a ejecutar `git init` ni `git remote add`: el repositorio ya
está inicializado y conectado con GitHub.

## 2. Habilitar GitHub Pages (solo la primera vez)

En GitHub abrir:

`Settings` → `Pages` → `Build and deployment`

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
- Presionar `Save`

## 3. Abrir el sitio

Esperar uno o dos minutos después del push y visitar:

https://francocontino.github.io/primestore/

El archivo de entrada requerido por GitHub Pages es `index.html`, que redirige
al widget de stock.
