import * as queries from '../db/queries';

interface RelatedNote {
  recordingId: string;
  title: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getRelatedNotes(
  recordingId: string,
  topK: number = 5
): Promise<RelatedNote[]> {
  const allEmbeddings = await queries.getAllEmbeddings();

  // Get embeddings for the current recording
  const currentEmbeddings = allEmbeddings.filter((e) => e.recordingId === recordingId);
  if (currentEmbeddings.length === 0) return [];

  // Get average vector for current recording
  const currentVectors = currentEmbeddings
    .filter((e) => e.vector)
    .map((e) => Array.from(new Float32Array(e.vector as ArrayBuffer)));

  if (currentVectors.length === 0) return [];

  const dim = currentVectors[0].length;
  const avgVector = new Array(dim).fill(0);
  for (const v of currentVectors) {
    for (let i = 0; i < dim; i++) avgVector[i] += v[i];
  }
  for (let i = 0; i < dim; i++) avgVector[i] /= currentVectors.length;

  // Compare with other recordings
  const otherEmbeddings = allEmbeddings.filter((e) => e.recordingId !== recordingId);
  const recordingScores = new Map<string, number[]>();

  for (const emb of otherEmbeddings) {
    if (!emb.vector) continue;
    const vector = Array.from(new Float32Array(emb.vector as ArrayBuffer));
    const score = cosineSimilarity(avgVector, vector);
    const scores = recordingScores.get(emb.recordingId) ?? [];
    scores.push(score);
    recordingScores.set(emb.recordingId, scores);
  }

  // Average scores per recording and sort
  const results: RelatedNote[] = [];
  for (const [recId, scores] of recordingScores.entries()) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const recording = await queries.getRecordingById(recId);
    results.push({
      recordingId: recId,
      title: recording?.title ?? 'Untitled',
      score: avgScore,
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
