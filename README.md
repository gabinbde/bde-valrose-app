# BDE Valrose App — React + Vite (pré-configurée Supabase + PWA)

## Lancer en local
1) Ouvre un terminal dans ce dossier
2) npm install
3) npm run dev
4) Ouvre http://localhost:5173

## Déployer (Vercel)
- Crée un nouveau projet Vercel, connecte ce dossier
- Build command: npm run build
- Output dir: dist
- Route SPA: vercel.json s'en charge

## Notes
- Supabase est déjà branché via window.__ENV__ dans index.html
- En absence de lib globale, l'app passe en mode mock (pas d'email réel)
- Place des policies RLS dans Supabase si besoin (voir pack précédent)
