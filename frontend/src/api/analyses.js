import client from './client'

export async function createAnalysis(repoUrl) {
  const res = await client.post('/api/v1/analyses/', { repo_url: repoUrl })
  return res.data
}

export async function listAnalyses(page = 1, limit = 20) {
  const res = await client.get('/api/v1/analyses/', { params: { page, limit } })
  return res.data
}

export async function getAnalysis(id) {
  const res = await client.get(`/api/v1/analyses/${id}`)
  return res.data
}

export async function deleteAnalysis(id) {
  await client.delete(`/api/v1/analyses/${id}`)
}
