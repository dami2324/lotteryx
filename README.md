# LotteryX

LotteryX es una app web para mostrar un Top 10 de terminaciones de la Loteria Nacional de Panama usando solo el patron:

`2do/3ro premio -> posible brinco al 1er premio`

La pantalla principal muestra:

- Proximo sorteo objetivo: Miercolito o Dominical.
- 5 terminaciones principales.
- 5 terminaciones backup.
- Senales recientes tomadas de segundo y tercer premio.
- Ultimos sorteos usados por el calculo.

## Desarrollo local

```bash
npm install
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

API de datos:

```text
http://localhost:3000/api/picks
```

## Despliegue en Vercel

1. Sube este proyecto a GitHub.
2. Importa el repositorio en Vercel.
3. Usa la configuracion automatica de Next.js.
4. Build command: `npm run build`
5. Output: Next.js default.

## Actualizacion de datos

La app intenta leer el historial paginado de LotteryGuru en cada ejecucion dinamica y recalcula el ranking. Si la fuente externa falla temporalmente, usa como respaldo el archivo local:

```text
analisis_miercolito_20mayo2026.txt
```

Ese respaldo evita que la pagina quede en blanco.

## Nota

LotteryX no garantiza resultados. El ranking es una lectura estadistica de un patron empirico.
