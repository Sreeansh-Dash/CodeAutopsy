import { useQuery } from '@tanstack/react-query'
import { getFiles, getDependencies, getPatterns, getMetrics, getInsights } from '../api/results'

export function useFiles(analysisId, enabled) {
  return useQuery({
    queryKey: ['files', analysisId],
    queryFn: () => getFiles(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useDependencies(analysisId, enabled) {
  return useQuery({
    queryKey: ['dependencies', analysisId],
    queryFn: () => getDependencies(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function usePatterns(analysisId, enabled) {
  return useQuery({
    queryKey: ['patterns', analysisId],
    queryFn: () => getPatterns(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useMetrics(analysisId, enabled) {
  return useQuery({
    queryKey: ['metrics', analysisId],
    queryFn: () => getMetrics(analysisId),
    enabled: !!analysisId && enabled,
  })
}

export function useInsights(analysisId, enabled) {
  return useQuery({
    queryKey: ['insights', analysisId],
    queryFn: () => getInsights(analysisId),
    enabled: !!analysisId && enabled,
  })
}
