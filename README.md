# E-commerce app on Kubernetes with GitOps and monitoring

This was my end-of-year Kubernetes project for my Master's at ESGI Paris. The idea was to take a small but complete application and run it the way you would in a real team: containerised, deployed on Kubernetes from Git with ArgoCD, built and tested by a CI pipeline, and monitored with metrics and logs in Grafana.

The app itself is simple on purpose. There's a React shop (product list, search, cart) and a Node.js / Express API that serves the products. The interesting part is everything around it.

![The shop running on the cluster](screenshots/02-app.png)

## The big picture

In short, Git is the source of truth for both the code and the infrastructure, and everything else follows from it:

```
  code push
      │
      ▼
  CI pipeline ── runs the tests ── builds the Docker images ── pushes them to GHCR
                                                                      │
  Kubernetes manifests in Git (k8s/)                                  │
      │                                                               │
      ▼                                                               ▼
  ArgoCD keeps the cluster in sync with Git  ──────▶  cluster pulls the images
                                                              │
                                                              ▼
                     users ──▶ Ingress (ecommerce.local) ──▶ frontend / backend pods
                                                              │
                                                              ▼
                     Prometheus scrapes metrics, Alloy ships logs to Loki ──▶ Grafana
```

1. I push code. The CI pipeline runs the backend tests, and if they pass it builds the frontend and backend images and pushes them to GitHub Container Registry.
2. The Kubernetes manifests live in the same repo. ArgoCD runs inside the cluster, watches them and applies any change automatically. I never run `kubectl apply` by hand for the app, I change Git and ArgoCD does the rest.
3. The cluster pulls the images from the registry and runs 2 pods of each service. An Ingress sends `/api` traffic to the backend and everything else to the frontend.
4. While it runs, Prometheus collects the backend's metrics and Alloy collects the logs of every pod into Loki. I look at both in Grafana.

The details of each part are below.

## What's in here

```
backend/      Node.js / Express API, Jest + Supertest tests, Dockerfile
frontend/     React app served by nginx, Dockerfile
k8s/          Kubernetes manifests (Kustomize)
argocd/       ArgoCD Application
monitoring/   Helm values and install script for the monitoring stack
.gitlab-ci.yml  CI pipeline: test, build, push images
```

## How it works

**The application**

- The API exposes CRUD endpoints on `/api/products`, plus `/health` and `/ready` for Kubernetes and `/metrics` for Prometheus. I added custom metrics with `prom-client`: request count by route, method and status, request duration, and product operations.
- The frontend is a React build served by `nginx-unprivileged` on port 8080.

**Docker images**

- Both images are multi-stage builds. The backend only ships production dependencies, and the frontend final image is just nginx with the static build.
- Neither container runs as root. The backend runs as the `node` user, the frontend as nginx's UID 101.

**Kubernetes**

- Everything runs in an `ecommerce` namespace, with 2 replicas of each service.
- Every container has CPU/memory requests and limits, liveness and readiness probes, and a locked-down `securityContext`: no privilege escalation, all capabilities dropped, and a read-only root filesystem for the backend.
- A single NGINX Ingress on `ecommerce.local` sends `/api` to the backend and everything else to the frontend, so the browser only ever talks to one host.

![Pods, services and ingress](screenshots/01-kubectl-pods.png)

**GitOps with ArgoCD**

ArgoCD watches the `k8s/` folder on `main` and keeps the cluster in sync with it. Auto-sync is on with `prune` and `selfHeal`, so if I delete something in Git it gets removed from the cluster, and if someone changes something by hand with `kubectl`, ArgoCD puts it back.

![ArgoCD applications](screenshots/03-argocd-list.png)
![ArgoCD resource tree](screenshots/04-argocd-tree.png)

**CI pipeline**

The pipeline has two stages:

1. **test**: installs the backend dependencies and runs the Jest / Supertest tests, keeping the coverage report as an artifact.
2. **build**: builds both images with Kaniko, so no Docker daemon is needed in the runner, and pushes them to GitHub Container Registry tagged with the commit SHA and `latest`.

The registry credentials are masked CI/CD variables, not stored in the repo. The code lives on GitHub, and the pipeline runs on a GitLab mirror of the repo.

![Pipeline passing](screenshots/07-gitlab-pipeline.png)

**Monitoring**

I used the Grafana stack, installed with Helm:

- **Prometheus + Grafana** (kube-prometheus-stack) for metrics. A `ServiceMonitor` scrapes the backend's `/metrics` every 15 seconds.
- **Loki** stores the logs, and **Alloy** collects them from every pod and ships them to Loki.
- **Tempo** is deployed and added as a Grafana data source, ready for traces.

![Backend metrics in Grafana](screenshots/05-grafana-metrics.png)
![Application logs in Grafana via Loki](screenshots/06-grafana-logs.png)

## Running it yourself

You need Minikube, kubectl and Helm.

```bash
minikube start --cpus=4 --memory=8g --driver=docker
minikube addons enable ingress
```

Deploy the app:

```bash
kubectl apply -k k8s/
kubectl get pods,svc,ingress -n ecommerce
```

Add `127.0.0.1 ecommerce.local` to your hosts file, run `minikube tunnel` in a separate terminal, and open http://ecommerce.local.

To let ArgoCD manage it instead:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/application.yaml
```

Monitoring:

```bash
cd monitoring && ./install.sh
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
```

If you just want to try the app without Kubernetes, `docker compose up --build` starts both services locally (frontend on 8080, API on 3001).

## What I'd improve next

- **Closing the loop between CI and GitOps.** Right now the pipeline pushes new images, but the manifests use the `latest` tag, so ArgoCD doesn't see a change in Git and a new build isn't rolled out on its own. The next step is to have the pipeline update the image tag (the commit SHA) in `k8s/`, or to use ArgoCD Image Updater, so that every push actually ends up deployed.
- **Traces.** Tempo is running, but the backend isn't instrumented with OpenTelemetry yet, so no traces are sent. That's the missing piece to have metrics, logs and traces all in one place.
- **Storage.** Loki and the monitoring data use ephemeral storage, which is fine on Minikube but would need persistent volumes anywhere else.
- **Real data.** The products are kept in memory in the API. A real version would need a database.
- **Hardening for production.** CORS is wide open and Grafana keeps its default login, both fine for a demo but not for anything public.
