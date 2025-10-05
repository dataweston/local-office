# Local Office Infrastructure Package

Contains Kubernetes manifests, Helm charts, and CI/CD workflows for deploying the Local Office platform. The goal is to standardize deployments across API, worker, dispatcher, labeler, billing, and web workloads.

## Planned deliverables
- Base Helm chart with configurable deployments, HPAs, and ingress
- GitHub Actions workflows for linting, testing, and shipping container images
- Documentation on required secrets and environment variables per environment
