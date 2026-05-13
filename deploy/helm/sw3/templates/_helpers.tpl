{{/*
deploy/helm/sw3/templates/_helpers.tpl
Common template helpers for the SW3 Helm chart.
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "sw3.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "sw3.fullname" -}}
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
Chart label: name-version
*/}}
{{- define "sw3.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "sw3.labels" -}}
helm.sh/chart: {{ include "sw3.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: sw3
{{- end }}

{{/*
Selector labels for a given component name.
Usage: {{ include "sw3.selectorLabels" (dict "component" "api-gateway" "context" .) }}
*/}}
{{- define "sw3.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
{{- end }}

{{/*
Image reference helper.
Usage: {{ include "sw3.image" (dict "image" .Values.apiGateway.image "global" .Values.global) }}
*/}}
{{- define "sw3.image" -}}
{{- $registry := .global.imageRegistry -}}
{{- $repo := .image.repository -}}
{{- $tag := .image.tag | default "latest" -}}
{{- if $registry -}}
{{ printf "%s/%s:%s" $registry $repo $tag }}
{{- else -}}
{{ printf "%s:%s" $repo $tag }}
{{- end -}}
{{- end }}

{{/*
Pull policy helper — returns the image pull policy.
*/}}
{{- define "sw3.pullPolicy" -}}
{{ .Values.image.pullPolicy | default "IfNotPresent" }}
{{- end }}

{{/*
Namespace name helper.
*/}}
{{- define "sw3.namespace" -}}
{{- .Values.namespace.name | default "sw3" }}
{{- end }}

{{/*
External secret name helper.
*/}}
{{- define "sw3.secretName" -}}
{{- .Values.externalSecrets.secretName | default "sw3-secrets" }}
{{- end }}
