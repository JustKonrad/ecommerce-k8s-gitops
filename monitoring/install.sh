#!/usr/bin/env bash
# Installe la stack LGTM + Alloy sur le cluster (namespace: monitoring)
set -euo pipefail

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# M + G : Prometheus + Grafana
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  -n monitoring -f values-kube-prometheus-stack.yaml

# L : Loki
helm upgrade --install loki grafana/loki \
  -n monitoring -f values-loki.yaml

# T : Tempo
helm upgrade --install tempo grafana/tempo \
  -n monitoring -f values-tempo.yaml

# A : Alloy (collecte les logs -> Loki)
helm upgrade --install alloy grafana/alloy \
  -n monitoring -f values-alloy.yaml

# ServiceMonitor pour scraper /metrics du backend
kubectl apply -f servicemonitor-backend.yaml

echo ""
echo "OK. Grafana : kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80"
echo "Login : admin / admin"
