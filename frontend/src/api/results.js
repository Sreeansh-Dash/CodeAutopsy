import client from './client'

export async function getFiles(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/files`)
  return res.data
}

export async function getDependencies(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/dependencies`)
  return res.data
}

export async function getPatterns(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/patterns`)
  return res.data
}

export async function getMetrics(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/metrics`)
  return res.data
}

export async function getInsights(analysisId) {
  const res = await client.get(`/api/v1/analyses/${analysisId}/insights`)
  return res.data
}
