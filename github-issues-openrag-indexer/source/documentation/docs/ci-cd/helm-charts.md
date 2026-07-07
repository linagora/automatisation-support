---
title: Helm Charts
sidebar_position: 3
---

Helm charts live under the [helm-charts](https://ci.linagora.com/linagora/lrs/saas/tools/helm-charts) GitLab group. Each service gets its own repository within that group (e.g. `helm-charts/twp-ldap-rest`, `helm-charts/twp-registration`). Charts are published to the private Harbor registry at `docker-registry.linagora.com` via GitLab CI.

## Chart Skeleton

Use this as a starting point when creating a chart for a new service. Replace every occurrence of `twp-my-service` and `my-service` with your service name.

### `twp-my-service/Chart.yaml`

```yaml
apiVersion: v2
appVersion: 0.1.0
dependencies:
  - name: commons
    version: 1.0.0
    repository: "https://docker-registry.linagora.com:5000/chartrepo/helm-repository"
description: A Helm chart for Twake Workplace My Service
home: "https://linagora.com"
kubeVersion: ">=1.22"
maintainers:
  - name: Your Name
    email: you@linagora.com
    url: https://github.com/your-handle
name: twp-my-service
sources:
  - "https://github.com/linagora/twake-workplace-private/"
version: "0.1.0"
```

All charts depend on the **commons** library chart, which provides shared helpers for image rendering, value templating, and security context compatibility.

### `twp-my-service/values.yaml`

```yaml
imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

deployment:
  replicaCount: 1
  image:
    repository: docker-registry.linagora.com/twake-workplace/twake-my-service
    pullPolicy: IfNotPresent
    tag: "v0.1.0"

  livenessProbe: {}
  #  httpGet:
  #    path: /healthz
  #    port: http
  readinessProbe: {}
  #  httpGet:
  #    path: /healthz
  #    port: http

  nodeSelector: {}
  tolerations: []
  affinity: {}

  podSecurityContext:
    enabled: false
  containerSecurityContext:
    enabled: false

  resources: {}
    # limits:
    #   cpu: 500m
    #   memory: 512Mi
    # requests:
    #   cpu: 100m
    #   memory: 256Mi

# Application configuration (non-sensitive)
config:
  port: 3000
  logLevel: info
  # Add service-specific config here

# Sensitive values (will go into a Secret)
secrets: {}
  # dbPassword: change-me

ingress:
  enabled: false
  className: "traefik"
  annotations: {}
  hosts:
    - host: my-service.example.com
  tls:
    enabled: false
    secretName: twp-my-service-tls
```

### `twp-my-service/templates/_helpers.tpl`

```go
{{/*
Expand the name of the chart.
*/}}
{{- define "twp-my-service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name, truncated to 63 chars (DNS limit).
*/}}
{{- define "twp-my-service.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label value.
*/}}
{{- define "twp-my-service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "twp-my-service.labels" -}}
helm.sh/chart: {{ include "twp-my-service.chart" . }}
app: twake
component: my-service
{{ include "twp-my-service.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for pod matching.
*/}}
{{- define "twp-my-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "twp-my-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Render the Docker image reference using the commons helper.
*/}}
{{- define "twp-my-service.image" -}}
{{ include "common.images.image" (dict "imageRoot" .Values.deployment.image ) }}
{{- end -}}
```

### `twp-my-service/templates/configmap.yaml`

Non-sensitive environment variables. Map your `config.*` values to the env vars your service expects.

<!-- prettier-ignore -->
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "twp-my-service.fullname" . }}
  labels:
    {{- include "twp-my-service.labels" . | nindent 4 }}
data:
  PORT: {{ .Values.config.port | quote }}
  LOG_LEVEL: {{ .Values.config.logLevel | quote }}
  # Add more env vars here
```

### `twp-my-service/templates/secret.yaml`

Sensitive values, base64-encoded automatically by Helm.

```yaml
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: {{ include "twp-my-service.fullname" . }}
data:
  {{- range $key, $value := .Values.secrets }}
  {{ $key }}: {{ $value | b64enc | quote }}
  {{- end }}
```

### `twp-my-service/templates/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "twp-my-service.fullname" . }}
  labels:
    {{- include "twp-my-service.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.deployment.replicaCount }}
  selector:
    matchLabels:
      {{- include "twp-my-service.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        checksum/secrets: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
      labels:
        {{- include "twp-my-service.selectorLabels" . | nindent 8 }}
    spec:
      {{- if .Values.deployment.affinity }}
      affinity: {{- include "common.tplvalues.render" (dict "value" .Values.deployment.affinity "context" $) | nindent 8 }}
      {{- end }}
      {{- if .Values.deployment.nodeSelector }}
      nodeSelector: {{- include "common.tplvalues.render" (dict "value" .Values.deployment.nodeSelector "context" $) | nindent 8 }}
      {{- end }}
      {{- if .Values.deployment.podSecurityContext.enabled }}
      securityContext: {{- include "common.compatibility.renderSecurityContext" (dict "secContext" .Values.deployment.podSecurityContext "context" $) | nindent 8 }}
      {{- end }}
      containers:
        - name: my-service
          image: {{ template "twp-my-service.image" . }}
          imagePullPolicy: {{ .Values.deployment.image.pullPolicy }}
          {{- if .Values.deployment.containerSecurityContext.enabled }}
          securityContext: {{- include "common.compatibility.renderSecurityContext" (dict "secContext" .Values.deployment.containerSecurityContext "context" $) | nindent 12 }}
          {{- end }}
          envFrom:
            - configMapRef:
                name: {{ include "twp-my-service.fullname" . }}
            - secretRef:
                name: {{ include "twp-my-service.fullname" . }}
          ports:
            - name: http
              containerPort: {{ .Values.config.port }}
              protocol: TCP
          {{- with .Values.deployment.livenessProbe }}
          livenessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.deployment.readinessProbe }}
          readinessProbe:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          resources:
            {{- toYaml .Values.deployment.resources | nindent 12 }}
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- if .Values.deployment.tolerations }}
      tolerations: {{- include "common.tplvalues.render" (dict "value" .Values.deployment.tolerations "context" $) | nindent 8 }}
      {{- end }}
```

Key details:

- **Checksum annotations** on the pod template force a rolling restart whenever the ConfigMap or Secret content changes.
- **`envFrom`** injects all ConfigMap and Secret keys as environment variables, so you do not need to list them individually.
- **Commons helpers** (`common.tplvalues.render`, `common.compatibility.renderSecurityContext`) handle value rendering and cross-version security context compatibility.

### `twp-my-service/templates/service.yaml`

<!-- prettier-ignore -->
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "twp-my-service.fullname" . }}
  labels:
    {{- include "twp-my-service.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.config.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "twp-my-service.selectorLabels" . | nindent 4 }}
```

### `twp-my-service/templates/ingress.yaml`

```yaml
{{- if .Values.ingress.enabled -}}
{{- if and .Values.ingress.className (not (semverCompare ">=1.18-0" .Capabilities.KubeVersion.GitVersion)) }}
  {{- if not (hasKey .Values.ingress.annotations "kubernetes.io/ingress.class") }}
  {{- $_ := set .Values.ingress.annotations "kubernetes.io/ingress.class" .Values.ingress.className}}
  {{- end }}
{{- end }}
{{- if semverCompare ">=1.19-0" .Capabilities.KubeVersion.GitVersion -}}
apiVersion: networking.k8s.io/v1
{{- else if semverCompare ">=1.14-0" .Capabilities.KubeVersion.GitVersion -}}
apiVersion: networking.k8s.io/v1beta1
{{- else -}}
apiVersion: extensions/v1beta1
{{- end }}
kind: Ingress
metadata:
  name: {{ include "twp-my-service.fullname" . }}
  labels:
    {{- include "twp-my-service.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if and .Values.ingress.className (semverCompare ">=1.18-0" .Capabilities.KubeVersion.GitVersion) }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls.enabled }}
  tls:
    - hosts:
    {{- range .Values.ingress.hosts }}
        - {{ .host | quote }}
    {{- end }}
      secretName: {{ .Values.ingress.tls.secretName }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "twp-my-service.fullname" $ }}
                port:
                  number: {{ $.Values.config.port }}
    {{- end }}
{{- end }}
```

## Publishing Charts with GitLab CI

Each chart repository includes a `.gitlab-ci.yml` at the repo root. The pipeline has two stages:

1. **Lint** (on merge requests) -- validates the chart syntax
2. **Publish** (on push to the default branch, when chart files changed) -- packages and pushes to Harbor

```yaml
stages:
  - lint
  - publish

variables:
  CHART: twp-my-service

package-lint:
  stage: lint
  image:
    name: alpine/helm:3.12.0
    entrypoint: [""]
  tags:
    - docker
  script:
    - >
      helm repo add linagora
      --username ${REGISTRY_USER}
      --password ${REGISTRY_TOKEN}
      ${REGISTRY_HELM_URL}
    - helm dependency build ${CHART}
    - helm lint ${CHART} -f ${CHART}/values.yaml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

package-publish:
  stage: publish
  image:
    name: alpine/helm:3.12.0
    entrypoint: [""]
  tags:
    - docker
  before_script:
    - apk add git
    - helm plugin install https://github.com/chartmuseum/helm-push
    - >
      helm repo add linagora
      --username ${REGISTRY_USER}
      --password ${REGISTRY_TOKEN}
      ${REGISTRY_HELM_URL}
    - helm dependency build ${CHART}
  script:
    - helm package ${CHART}
    - helm cm-push ${CHART}*.tgz linagora --force
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH'
      changes:
        - ${CHART}/**/*
```

The pipeline requires three CI/CD variables configured in the GitLab project settings:

| Variable            | Purpose                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `REGISTRY_USER`     | Harbor username                                                                              |
| `REGISTRY_TOKEN`    | Harbor password or token                                                                     |
| `REGISTRY_HELM_URL` | ChartMuseum URL (e.g. `https://docker-registry.linagora.com:5000/chartrepo/helm-repository`) |

## Bootstrapping Checklist

When adding a Helm chart for a new service:

1. Create a new repository under the [helm-charts](https://ci.linagora.com/linagora/lrs/saas/tools/helm-charts) group, named `twp-{service}`
2. Copy the skeleton above into a `twp-{service}/` directory at the repo root
3. Find-and-replace `twp-my-service` / `my-service` with your service name
4. Add the `.gitlab-ci.yml` from the section above to the repo root and set the `CHART` variable
5. Update `Chart.yaml` metadata (description, maintainers, appVersion)
6. Set the correct image repository and tag in `values.yaml`
7. Map your service's environment variables in the ConfigMap and Secret templates
8. Configure the CI/CD variables (`REGISTRY_USER`, `REGISTRY_TOKEN`, `REGISTRY_HELM_URL`) in the GitLab project settings
9. Run `helm dependency build twp-{service}` to fetch the commons chart
10. Run `helm lint twp-{service} -f twp-{service}/values.yaml` to validate
11. Push to the default branch -- the publish job packages and pushes the chart to Harbor
