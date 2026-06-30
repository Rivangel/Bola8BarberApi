/**
 * Punto de entrada para Vercel (Serverless Function).
 *
 * Vercel toma el export por defecto de este archivo como handler. Una app de
 * Express es, en sí misma, una función `(req, res)`, así que la reutilizamos tal
 * cual. Todo el enrutamiento real vive en `index.ts` (raíz del proyecto); aquí
 * sólo la reexportamos. El rewrite de `vercel.json` envía todas las rutas aquí.
 */
import app from '../index';

export default app;
