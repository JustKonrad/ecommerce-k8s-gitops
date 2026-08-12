# 🛍️ E-Commerce sur Kubernetes — DevOps & GitOps

> Projet M2 — *Déployer une application complète sur K8S-t3*
> Déploiement d'une application e-commerce (React + Node.js/Express) sur Kubernetes,
> avec pipeline CI/CD, GitOps (ArgoCD) et observabilité complète (LGTM + Alloy).

**Auteur :** Konrad — **Repo :** `https://github.com/JustKonrad/ecommerce-k8s-gitops`

---

## 1. Sommaire

1. Architecture
2. Arborescence du dépôt
3. Prérequis
4. Démarrage rapide (TL;DR)
5. Étape 1 — Build & push des images Docker
6. Étape 2 — Déploiement Kubernetes (local Minikube)
7. Étape 3 — GitOps avec ArgoCD
8. Étape 4 — Monitoring LGTM + Alloy
9. Étape 5 — Pipeline CI/CD (.gitlab-ci.yml)
10. Résultats & captures
11. Choix techniques / sécurité
12. Correspondance avec le barème

---

## 2. Architecture

```
                        Navigateur
                            │  http://ecommerce.local
                            ▼
                   ┌──────────────────┐
                   │  Ingress (nginx) │
                   └───────┬──────────┘
                 /         │           /api
        ┌────────▼──────┐   └──────▼───────────┐
        │  Service      │          │ Service    │
        │  frontend:80  │          │ backend:3001│
        └───────┬───────┘          └─────┬──────┘
                │                         │
        ┌───────▼────────┐        ┌───────▼─────────┐
        │ Deployment     │        │ Deployment      │
        │ frontend (x2)  │        │ backend (x2)    │
        │ nginx :8080    │        │ node/express    │
        └────────────────┘        └───────┬─────────┘
                                          │ /metrics
                                          ▼
   Observabilité (namespace monitoring)
   ┌───────────┬─────────┬────────┬───────┬──────────┐
   │ Prometheus│  Loki   │ Tempo  │ Alloy │ Grafana  │
   │   (M)     │  (L)    │  (T)   │  (A)  │   (G)    │
   └───────────┴─────────┴────────┴───────┴──────────┘
   Alloy collecte les logs des pods → Loki
   Prometheus scrape backend:/metrics (ServiceMonitor)
   Grafana lit Prometheus + Loki + Tempo
```

**GitOps :** `git push` → ArgoCD détecte le changement dans `k8s/` → synchronise le cluster automatiquement (`prune` + `selfHeal`).

---

## 3. Arborescence du dépôt

```
.
├── backend/            # API Node.js/Express (+ Dockerfile multi-stage)
│   ├── src/index.js
│   ├── tests/products.test.js
│   └── Dockerfile
├── frontend/           # SPA React (+ Dockerfile multi-stage nginx)
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── k8s/                # Manifests Kubernetes (Deployments, Services, Ingress)
│   ├── 00-namespace.yaml … 30-ingress.yaml
│   └── kustomization.yaml
├── argocd/
│   └── application.yaml # Application ArgoCD (source de vérité = ce repo)
├── monitoring/         # Stack LGTM + Alloy (Helm values + install.sh)
├── .gitlab-ci.yml      # Pipeline CI/CD (test → build → push GHCR)
├── docker-compose.yml  # Dev local sans K8s (bonus)
└── README.md           # Ce rapport
```

---

## 4. Prérequis

```bash
minikube version   # v1.30+
kubectl version    # v1.27+
helm version       # v3.x
docker version
```

Démarrer un cluster avec assez de RAM pour la stack de monitoring :

```bash
minikube start --cpus=4 --memory=6g --driver=docker
minikube addons enable ingress
```

---

## 5. Démarrage rapide (TL;DR)

```bash
# 1. Images (voir §6 pour le détail / la CI le fait automatiquement)
# 2. Déploiement app
kubectl apply -k k8s/

# 3. GitOps
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/application.yaml

# 4. Monitoring
cd monitoring && ./install.sh

# 5. Accès app
echo "$(minikube ip) ecommerce.local" | sudo tee -a /etc/hosts
# puis ouvrir http://ecommerce.local
```

---

## 6. Étape 1 — Build & push des images Docker

Les deux images sont poussées sur **GitHub Container Registry (ghcr.io)**.

```bash
# Auth GHCR (PAT avec scope write:packages)
echo $GHCR_TOKEN | docker login ghcr.io -u justkonrad --password-stdin

# Backend
docker build -t ghcr.io/justkonrad/ecommerce-backend:latest ./backend
docker push ghcr.io/justkonrad/ecommerce-backend:latest

# Frontend (l'URL de l'API est injectée au build)
docker build --build-arg REACT_APP_API_URL=http://ecommerce.local \
  -t ghcr.io/justkonrad/ecommerce-frontend:latest ./frontend
docker push ghcr.io/justkonrad/ecommerce-frontend:latest
```

> ⚠️ Rendre les 2 packages **publics** (GitHub → Packages → Package settings → Change visibility → Public) pour que le cluster les tire sans `imagePullSecret`.

**Dockerfiles — points clés :**
- Multi-stage (dépendances / runtime séparés) → images légères.
- Backend : image `node:18-alpine`, exécution en utilisateur **non-root** (`node`), `readOnlyRootFilesystem`, `HEALTHCHECK` sur `/health`.
- Frontend : build React puis service via **nginx non-root** (`nginx-unprivileged`, port 8080).

`[CAPTURE 1 : docker build/push réussi + packages visibles sur GitHub]`

---

## 7. Étape 2 — Déploiement Kubernetes (local Minikube)

```bash
kubectl apply -k k8s/
kubectl -n ecommerce get pods,svc,ingress
```

Résultat attendu : 2 pods `backend`, 2 pods `frontend` en `Running`, un Ingress `ecommerce.local`.

```bash
echo "$(minikube ip) ecommerce.local" | sudo tee -a /etc/hosts
curl http://ecommerce.local/api/products      # renvoie la liste JSON
```

Ouvrir `http://ecommerce.local` : catalogue, recherche/filtres et panier fonctionnels.

`[CAPTURE 2 : kubectl get pods -n ecommerce (tout Running)]`
`[CAPTURE 3 : l'appli e-commerce dans le navigateur]`

**Manifests — points clés :** probes `liveness`/`readiness` (`/health`, `/ready`, `/healthz`), `requests`/`limits`, `securityContext` durci (non-root, capabilities drop ALL), 2 replicas par service.

---

## 8. Étape 3 — GitOps avec ArgoCD

Installer ArgoCD puis déclarer l'application :

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-server

kubectl apply -f argocd/application.yaml
```

Accès à l'UI + mot de passe admin initial :

```bash
kubectl -n argocd port-forward svc/argocd-server 8081:443
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
# UI : https://localhost:8081  (user: admin)
```

L'Application est configurée en **auto-sync** (`prune: true`, `selfHeal: true`) : tout commit sur `k8s/` est appliqué automatiquement. **Preuve GitOps** : modifier `replicas: 2 → 3` dans un Deployment, `git push`, et observer ArgoCD re-synchroniser sans action manuelle.

`[CAPTURE 4 : ArgoCD UI, application "ecommerce" Synced/Healthy]`
`[CAPTURE 5 : preuve auto-sync après un commit (replicas mis à jour)]`

---

## 9. Étape 4 — Monitoring LGTM + Alloy

```bash
cd monitoring && ./install.sh
kubectl -n monitoring get pods
```

Composants installés :
- **Prometheus (M)** — scrape `backend:/metrics` via un `ServiceMonitor`.
- **Loki (L)** — agrégation des logs.
- **Tempo (T)** — backend de traces (déployé, prêt pour OTLP).
- **Alloy (A)** — collecte les logs de tous les pods et les pousse vers Loki.
- **Grafana (G)** — dashboards, avec Prometheus + Loki + Tempo en datasources.

Accès Grafana :

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
# http://localhost:3000  (admin / admin)
```

Vérifications :
- **Métriques** : dans Grafana → Explore → Prometheus → requête `http_requests_total` ou `product_operations_total`.
- **Logs** : Explore → Loki → `{namespace="ecommerce"}`.

`[CAPTURE 6 : pods monitoring Running]`
`[CAPTURE 7 : Grafana, métriques http_requests_total du backend]`
`[CAPTURE 8 : Grafana, logs Loki du namespace ecommerce via Alloy]`

---

## 10. Étape 5 — Pipeline CI/CD (`.gitlab-ci.yml`)

Le pipeline (`test → build`) :
1. `test:backend` — `npm ci` + `npm test` (Jest/Supertest).
2. `build:backend` / `build:frontend` — build **Kaniko** (sans démon Docker) et push vers `ghcr.io` en `:latest` et `:<sha>`.

**Faire tourner la CI.** Le dépôt étant sur GitHub alors que le fichier est un `.gitlab-ci.yml`, la CI s'exécute via un **projet GitLab miroir** :
1. Sur gitlab.com : *New project → Import → Repository by URL* (ou *CI/CD for external repo*) en pointant le repo GitHub.
2. Définir les variables CI/CD : `GHCR_USER` = `justkonrad`, `GHCR_TOKEN` = PAT GitHub (scope `write:packages`, *Masked*).
3. Le pipeline se lance à chaque push et pousse les images sur GHCR.

`[CAPTURE 9 : pipeline GitLab vert (test + build backend + build frontend)]`

---

## 11. Résultats & captures

| # | Élément | Statut |
|---|---------|--------|
| 1 | Images Docker sur GHCR | `[à remplir]` |
| 2 | Pods ecommerce Running | `[à remplir]` |
| 3 | Application accessible | `[à remplir]` |
| 4 | ArgoCD Synced/Healthy | `[à remplir]` |
| 5 | Pipeline CI vert | `[à remplir]` |
| 6 | Grafana métriques + logs | `[à remplir]` |

---

## 12. Choix techniques / sécurité

- **Images non-root** (backend `node`, frontend `nginx-unprivileged`) + `capabilities drop ALL`, `allowPrivilegeEscalation: false`, backend en `readOnlyRootFilesystem`.
- **Multi-stage builds** → images minimales, surface d'attaque réduite.
- **Probes** liveness/readiness sur les deux services.
- **Registry GHCR** unique, cohérent avec l'hébergement GitHub.
- **CORS** ouvert côté API (démo) — à restreindre en production.

---

## 13. Correspondance avec le barème (100 pts)

| Critère | Points | Où c'est traité |
|---|---|---|
| Code source et tests | 20 | `backend/`, `frontend/`, `backend/tests/`, job `test:backend` |
| Dockerfiles optimisés | 15 | `backend/Dockerfile`, `frontend/Dockerfile` (multi-stage, non-root) |
| Kubernetes manifests | 15 | `k8s/` (Deployments, Services, Ingress, probes, securityContext) |
| Pipeline CI/CD | 20 | `.gitlab-ci.yml` (test + build + push GHCR) |
| GitOps (ArgoCD) | 15 | `argocd/application.yaml` (auto-sync) |
| Monitoring LGTM + Alloy | 15 | `monitoring/` (Prometheus, Loki, Tempo, Alloy, Grafana) |
